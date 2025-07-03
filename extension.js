const vscode = require('vscode');
const axios = require('axios');
const cheerio = require('cheerio');
const esprima = require('esprima');
const { getSearchHtml } = require('./ui/getSearchHtml');
const { getPostHtml } = require('./ui/getPostHtml');

const languageMap = {
    javascript: { search: 'JavaScript', prism: 'javascript' },
    python: { search: 'Python', prism: 'python' },
    typescript: { search: 'TypeScript', prism: 'typescript' },
    c: { search: 'C', prism: 'c' },
    cpp: { search: 'C++', prism: 'cpp' }
};

function isSupportedLanguage(className) {
    if (!className) return false;
    const supportedLanguages = Object.values(languageMap).map(lang => `language-${lang.prism}`);
    return supportedLanguages.some(lang => className.includes(lang.replace('language-', '')));
}

function looksLikeCode(text) {
    if (text.match(/<[a-zA-Z][^>]*>/) || text.match(/&[a-zA-Z0-9]+;/)) {
        return false;
    }
    return (
        text.match(/^\s*(function|def|class|import|export|if|for|while|try|except|with|#include|int|void|float|double|char|bool|struct|namespace)\s/) ||
        text.match(/[{}\[\]\(\)]/) ||
        text.match(/^\s*[\w]+\s*\([^()]*\)\s*{/) ||
        text.match(/\/\/.*|\/\*.*?\*\//) ||
        text.match(/->|::|\bnew\b|\bdelete\b/) ||
        text.match(/:\s*$/)
    );
}

function looksLikePython(text) {
    return text.match(/^\s*(def|class|if|elif|else|for|while|try|except|with)\s/) ||
           text.match(/:\s*$/);
}

function looksLikeCOrCpp(text) {
    return text.match(/^\s*(#include|int|void|float|double|char|bool|class|struct|namespace)\s/) ||
           text.match(/->|::|\bnew\b|\bdelete\b/);
}

function activate(context) {
    let searchPanel;
    let lastActiveEditor;

    const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && editor.document && editor.document.uri.scheme === 'file') {
            lastActiveEditor = editor;
            console.log('Updated last active editor:', lastActiveEditor.document.fileName, 'Language:', lastActiveEditor.document.languageId);
        }
    });
    context.subscriptions.push(editorChangeDisposable);

    const disposable = vscode.commands.registerCommand('scout.search', async () => {
        console.log('scout.search invoked, last active editor:', lastActiveEditor?.document.fileName || 'undefined');

        if (searchPanel) {
            searchPanel.reveal(vscode.ViewColumn.Beside);
            console.log('Search panel revealed');
        } else {
            searchPanel = vscode.window.createWebviewPanel(
                'scoutSearch',
                'Scout Search',
                vscode.ViewColumn.Beside,
                { enableScripts: true, retainContextWhenHidden: true }
            );
            console.log('Search panel created');

            searchPanel.webview.html = getSearchHtml();
            console.log('Search panel HTML set');

            console.log('Registering message handler');
            searchPanel.webview.onDidReceiveMessage(
                async (msg) => {
                    console.log('Received webview message:', JSON.stringify(msg));
                    try {
                        if (msg.command === 'search') {
                            console.log('Processing search command with query:', msg.text);
                            const contextTerms = await extractContextTerms(lastActiveEditor);
                            const language = lastActiveEditor ? languageMap[lastActiveEditor.document.languageId]?.search || 'JavaScript' : 'JavaScript';
                            const query = `${msg.text} in ${language} ${contextTerms.join(' ')}`.trim();
                            console.log('Search query:', query, 'Using editor:', lastActiveEditor?.document.fileName || 'none');
                            const results = await fetchSearchResults(query);
                            if (results) {
                                console.log('Search results received:', results.length);
                                const processedResults = await processSearchResults(results, contextTerms, lastActiveEditor?.document.languageId);
                                console.log('Processed results:', processedResults.length);
                                searchPanel.webview.postMessage({ command: 'results', query: msg.text, results: processedResults });
                            } else {
                                console.warn('No search results returned');
                                searchPanel.webview.postMessage({ command: 'error', message: 'No results found or search failed.' });
                            }
                        } else if (msg.command === 'openPostInNewPanel') {
                            console.log('Opening new panel for URL:', msg.url);
                            const signatures = await extractAPISignatures(msg.url, lastActiveEditor?.document.languageId);
                            const postPanel = vscode.window.createWebviewPanel(
                                'scoutPost',
                                'Post Content',
                                vscode.ViewColumn.Beside,
                                { enableScripts: true }
                            );
                            postPanel.webview.html = getPostHtml();
                            postPanel.webview.onDidReceiveMessage(
                                async (postMsg) => {
                                    if (postMsg.command === 'ready') {
                                        const updatedSignatures = await fetchPostContent(msg.url, postPanel.webview, lastActiveEditor?.document.languageId, signatures);
                                        searchPanel.webview.postMessage({ 
                                            command: 'postPanelReady',
                                            signatures: updatedSignatures 
                                        });
                                    }
                                },
                                null,
                                context.subscriptions
                            );
                            postPanel.onDidDispose(() => {
                                console.log('Post panel disposed');
                            }, null, context.subscriptions);
                        } else if (msg.command === 'showInfo') {
                            vscode.window.showInformationMessage(msg.message);
                        } else {
                            console.warn('Unknown command:', msg.command);
                        }
                    } catch (error) {
                        console.error('Error handling message:', error.message, error.stack);
                        searchPanel.webview.postMessage({ command: 'error', message: `Search error: ${error.message}` });
                        vscode.window.showErrorMessage(`Scout Search error: ${error.message}`);
                    }
                },
                null,
                context.subscriptions
            );

            searchPanel.onDidDispose(() => {
                searchPanel = undefined;
                lastActiveEditor = undefined;
                console.log('Search panel disposed, cleared lastActiveEditor');
            }, null, context.subscriptions);
        }
    });

    context.subscriptions.push(disposable);
}

function deactivate() {}

async function extractContextTerms(editor) {
    if (!editor) return [];
    const languageId = editor.document.languageId;
    const code = editor.document.getText();
    const terms = [];

    try {
        if (['javascript', 'typescript'].includes(languageId)) {
            const ast = esprima.parseScript(code, { loc: true, tolerant: true });
            const cursorPosition = editor.selection.active;

            function traverse(node, callback) {
                if (node && (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression')) {
                    const startLine = node.loc?.start?.line;
                    const endLine = node.loc?.end?.line;
                    if (startLine && endLine && cursorPosition.line >= startLine && cursorPosition.line <= endLine) {
                        callback(node);
                    }
                }
                for (const key in node) {
                    if (node[key] && typeof node[key] === 'object') {
                        traverse(node[key], callback);
                    }
                }
            }

            traverse(ast, (node) => {
                if (node.params) {
                    node.params.forEach(param => {
                        if (param.type === 'Identifier') {
                            terms.push(param.name);
                        }
                    });
                }
                terms.push('function');
            });

            ast.body.forEach(node => {
                if (node.type === 'VariableDeclaration') {
                    node.declarations.forEach(decl => {
                        if (decl.init && decl.init.type === 'CallExpression' && decl.init.callee.name === 'require') {
                            if (decl.init.arguments[0] && decl.init.arguments[0].value) {
                                terms.push(decl.init.arguments[0].value);
                            }
                        }
                    });
                }
            });
        } else if (languageId === 'python') {
            const functionRegex = /def\s+(\w+)\s*\(([^)]*)\):/g;
            let match;
            while ((match = functionRegex.exec(code)) !== null) {
                terms.push(match[1]);
                const params = match[2].split(',').map(p => p.trim()).filter(p => p);
                terms.push(...params);
            }
            terms.push('def');
        } else if (['c', 'cpp'].includes(languageId)) {
            const functionRegex = /(?:[\w:*&]+\s+)*(\w+)\s*\(([^)]*)\)\s*{/g;
            let match;
            while ((match = functionRegex.exec(code)) !== null) {
                terms.push(match[1]);
                const params = match[2].split(',').map(p => p.trim()).filter(p => p);
                params.forEach(param => {
                    const paramName = param.split(/\s+/).pop().replace(/[\[\]*&]/g, '');
                    if (paramName) terms.push(paramName);
                });
            }
            terms.push('function');
            terms.push('#include');
        }

        terms.push(languageMap[languageId]?.search || 'code');
    } catch (error) {
        console.error('Context extraction error:', error.message);
    }

    return [...new Set(terms)];
}

async function fetchSearchResults(query) {
    const apiKey = '8712d360c6ce7f5e72fa1db7bf7a7b8a03c71da937aa07ca8673ae6352216540';
    const params = {
        engine: 'google',
        q: query,
        num: 10,
        api_key: apiKey
    };

    try {
        console.log('Fetching search results for query:', query);
        const response = await axios.get('https://serpapi.com/search', { params, timeout: 3000 });
        console.log('Search results:', response.data.organic_results || []);
        return response.data.organic_results || [];
    } catch (error) {
        console.error('Search error:', error.message);
        return null;
    }
}

async function processSearchResults(results, contextTerms, languageId) {
    if (!results) return [];
    const processedResults = [];

    for (const result of results) {
        if (!result.link || !result.link.startsWith('https://')) {
            console.warn('Invalid or missing link:', result);
            continue;
        }
        const signatures = await extractAPISignatures(result.link, languageId);
        console.log('Signatures for', result.link, ':', signatures.length);
        const rankedSignatures = rankSignatures(signatures, contextTerms);
        processedResults.push({
            title: result.title || '',
            link: result.link || '',
            snippet: result.snippet || '',
            signatures: rankedSignatures.slice(0, 3)
        });
    }

    console.log('Processed results:', processedResults.length);
    return processedResults;
}

async function extractAPISignatures(url, languageId) {
    try {
        console.log('Extracting signatures from:', url, 'for language:', languageId);
        const response = await axios.get(url, {
            timeout: 6000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });
        const $ = cheerio.load(response.data, { normalizeWhitespace: false });
        const signatures = [];

        $('pre, code').each((_, el) => {
            let code = $(el).html();
            if (code && code.length > 10) {
                code = code.replace(/<br\s*\/?>/gi, '\n');
                code = cheerio.load(code).text();
                code = code.replace(/\r\n/g, '\n').replace(/\n\s*\n/g, '\n').trim();
                if (!code) return;

                let usageExample = '';
                const parentText = $(el).parent().text().trim();
                const lines = parentText.split('\n').map(line => line.trim()).filter(line => line);
                const codeIndex = lines.findIndex(line => line.includes(code.split('\n')[0].slice(0, 50)));
                if (codeIndex >= 0 && codeIndex + 1 < lines.length) {
                    usageExample = lines[codeIndex + 1].slice(0, 200);
                } else {
                    usageExample = code.split('\n')[0].slice(0, 200);
                }

                const fullCodeSnippet = code.trim();

                if (['javascript', 'typescript'].includes(languageId)) {
                    try {
                        const ast = esprima.parseScript(code, { loc: true, tolerant: true });
                        traverseASTForSignatures(ast, signatures, url, code);
                    } catch (error) {
                        console.warn('Esprima parsing failed for', url, ':', error.message);
                        const functionRegex = /(function\s+\w+\s*\([^)]*\)\s*{[^}]*})|(\w+\s*\([^)]*\))/g;
                        let match;
                        while ((match = functionRegex.exec(code)) !== null) {
                            signatures.push({
                                signature: match[0],
                                usageExample: usageExample || match[0],
                                fullCode: fullCodeSnippet.slice(0, 2000),
                                description: 'Extracted from code block',
                                language: languageMap[languageId]?.prism || 'javascript',
                                isAccepted: $(el).parents('.accepted-answer').length > 0,
                                isTopVoted: parseInt($(el).parents('.answer').find('.js-vote-count').text().trim()) > 10,
                                isRecent: false,
                                url
                            });
                        }
                    }
                } else if (languageId === 'python') {
                    const functionRegex = /def\s+(\w+)\s*\(([^)]*)\)\s*:/g;
                    let match;
                    while ((match = functionRegex.exec(code)) !== null) {
                        signatures.push({
                            signature: `def ${match[1]}(${match[2]})`,
                            usageExample: usageExample || match[0],
                            fullCode: fullCodeSnippet.slice(0, 2000),
                            description: 'Python function definition',
                            language: 'python',
                            isAccepted: $(el).parents('.accepted-answer').length > 0,
                            isTopVoted: parseInt($(el).parents('.answer').find('.js-vote-count').text().trim()) > 10,
                            isRecent: false,
                            url
                        });
                    }
                    const genericRegex = /(?:[\w.]+)\s*\(\s*([^)]*)\s*\)/g;
                    while ((match = genericRegex.exec(code)) !== null) {
                        signatures.push({
                            signature: match[0],
                            usageExample: usageExample || match[0],
                            fullCode: fullCodeSnippet.slice(0, 2000),
                            description: 'Python function call',
                            language: 'python',
                            isAccepted: $(el).parents('.accepted-answer').length > 0,
                            isTopVoted: parseInt($(el).parents('.answer').find('.js-vote-count').text().trim()) > 10,
                            isRecent: false,
                            url
                        });
                    }
                } else if (['c', 'cpp'].includes(languageId)) {
                    const functionRegex = /(?:[\w:*&]+\s+)*(\w+)\s*\(([^)]*)\)\s*{/g;
                    let match;
                    while ((match = functionRegex.exec(code)) !== null) {
                        const signature = `${match[1]}(${match[2]})`;
                        signatures.push({
                            signature: signature,
                            usageExample: usageExample || signature,
                            fullCode: fullCodeSnippet.slice(0, 2000),
                            description: `${languageId === 'c' ? 'C' : 'C++'} function definition`,
                            language: languageMap[languageId].prism,
                            isAccepted: $(el).parents('.accepted-answer').length > 0,
                            isTopVoted: parseInt($(el).parents('.answer').find('.js-vote-count').text().trim()) > 10,
                            isRecent: false,
                            url
                        });
                    }
                    const callRegex = /(?:[\w:]+)\s*\(\s*([^)]*)\s*\);?/g;
                    while ((match = callRegex.exec(code)) !== null) {
                        signatures.push({
                            signature: match[0],
                            usageExample: usageExample || match[0],
                            fullCode: fullCodeSnippet.slice(0, 2000),
                            description: `${languageId === 'c' ? 'C' : 'C++'} function call`,
                            language: languageMap[languageId].prism,
                            isAccepted: $(el).parents('.accepted-answer').length > 0,
                            isTopVoted: parseInt($(el).parents('.answer').find('.js-vote-count').text().trim()) > 10,
                            isRecent: false,
                            url
                        });
                    }
                } else {
                    const genericRegex = /(\w+)\s*\(/g;
                    let match;
                    while ((match = genericRegex.exec(code)) !== null) {
                        signatures.push({
                            signature: match[0],
                            usageExample: usageExample || match[0],
                            fullCode: fullCodeSnippet.slice(0, 2000),
                            description: 'Generic code pattern',
                            language: languageMap[languageId]?.prism || 'javascript',
                            isAccepted: $(el).parents('.accepted-answer').length > 0,
                            isTopVoted: parseInt($(el).parents('.answer').find('.js-vote-count').text().trim()) > 10,
                            isRecent: false,
                            url
                        });
                    }
                }
            }
        });

        console.log('Extracted signatures for', url, ':', signatures);
        return signatures.slice(0, 10);
    } catch (err) {
        console.error('Failed to extract from', url, ':', err.message);
        return [];
    }
}

function traverseASTForSignatures(ast, signatures, url, rawCode) {
    function traverse(node) {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'CallExpression') {
            const callee = node.callee;
            let signature = '';
            if (callee.type === 'MemberExpression' && callee.object?.name && callee.property?.name) {
                signature = `${callee.object.name}.${callee.property.name}(${node.arguments.map(arg => arg.type).join(', ')})`;
            } else if (callee.type === 'Identifier' && callee.name) {
                signature = `${callee.name}(${node.arguments.map(arg => arg.type).join(', ')})`;
            }
            if (signature) {
                const startLine = node.loc.start.line - 1;
                const endLine = node.loc.end.line;
                const lines = rawCode.split('\n');
                const start = Math.max(0, startLine - 2);
                const end = Math.min(lines.length, endLine + 2);
                const fullCodeSnippet = rawCode.trim();
                signatures.push({
                    signature,
                    usageExample: signature,
                    fullCode: fullCodeSnippet.slice(0, 2000),
                    description: 'Extracted from AST',
                    language: 'javascript',
                    isAccepted: false,
                    isTopVoted: false,
                    isRecent: false,
                    url
                });
            }
        } else if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression') {
            const name = node.id?.name || 'anonymous';
            const params = node.params.map(p => p.name || p.type).join(', ');
            const signature = `function ${name}(${params})`;
            const startLine = node.loc.start.line - 1;
            const endLine = node.loc.end.line;
            const lines = rawCode.split('\n');
            const start = Math.max(0, startLine - 2);
            const end = Math.min(lines.length, endLine + 2);
            const fullCodeSnippet = rawCode.trim();
            signatures.push({
                signature,
                usageExample: signature,
                fullCode: fullCodeSnippet.slice(0, 2000),
                description: 'Function declaration/expression',
                language: 'javascript',
                isAccepted: false,
                isTopVoted: false,
                isRecent: false,
                url
            });
        }
        for (const key in node) {
            if (node[key] && typeof node[key] === 'object') {
                traverse(node[key]);
            }
        }
    }
    traverse(ast);
}

function rankSignatures(signatures, contextTerms) {
    return signatures.sort((a, b) => {
        let scoreA = 0;
        let scoreB = 0;

        contextTerms.forEach(term => {
            if (a.signature?.includes(term)) scoreA += 1;
            if (b.signature?.includes(term)) scoreB += 1;
        });

        if (a.isAccepted) scoreA += 3;
        if (b.isAccepted) scoreB += 3;
        if (a.isTopVoted) scoreA += 2;
        if (b.isTopVoted) scoreB += 2;
        if (a.isRecent) scoreA += 1;
        if (b.isRecent) scoreB += 1;

        return scoreB - scoreA;
    });
}

async function fetchPostContent(url, webview, languageId, signatures = []) {
    const cheerio = require('cheerio');
    const axios = require('axios');

    function cleanText(html, $, isCode = false, isHeading = false, isParagraph = false) {
        const $temp = cheerio.load(html, { decodeEntities: true });
        if (!isCode) {
            $temp('script, style, iframe, noscript, button, a[href*="comment"], div[class*="tags"], div[class*="article-info"], footer').remove();
            $temp('*').each((_, el) => {
                const attrs = Object.keys(el.attribs || {});
                attrs.forEach(attr => {
                    if (attr.startsWith('on') || attr.startsWith('data-') || ['id', 'class', 'style'].includes(attr)) {
                        delete el.attribs[attr];
                    }
                });
            });
        }

        let cleanedHtml = $temp.html({
            xmlMode: false,
            decodeEntities: true,
            normalizeWhitespace: false
        });

        if (isCode) {
            cleanedHtml = cleanedHtml.replace(/\r\n/g, '\n').trim();
            return cheerio.load(cleanedHtml, { decodeEntities: true }).text().trim();
        } else if (isHeading) {
            return cleanedHtml.trim();
        } else if (isParagraph) {
            cleanedHtml = cleanedHtml.replace(/[\r\n]+/g, '\n').replace(/[ \t]+/g, ' ').trim();
            return cleanedHtml;
        } else {
            cleanedHtml = cleanedHtml.replace(/[\r\n]+/g, '\n').replace(/\s+/g, ' ').trim();
            return cheerio.load(cleanedHtml, { decodeEntities: true }).text().trim();
        }
    }

    function normalizeCode(code) {
        return code.replace(/\s+/g, ' ').trim();
    }

    function looksLikeCode(text) {
        if (!text) return false;
        const codePatterns = [
            /^\s*(function|def|class|if|for|while|return|yield|import|from|const|let|var)\b/, 
            /^\s*[\{\[\(]/, 
            /[\{\}\[\]\(\);\->=]<+\s*$/,
            /^\s*[a-zA-Z_][a-zA-Z0-9_]*\s*\(/ 
        ];
        const textPatterns = [
            /\b(I|you|we|they|this|that|which|where|how|why)\b/i, 
            /[.!?]\s+[A-Z]/, 
            /\b(more|less|about|because|however|therefore)\b/i 
        ];
        return codePatterns.some(pattern => pattern.test(text)) && !textPatterns.some(pattern => pattern.test(text));
    }

    const storedCodeSnippets = [];

    try {
        console.log('Fetching content for', url);
        const response = await axios.get(url, {
            timeout: 5000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            }
        });

        console.log('Processing content');
        const $ = cheerio.load(response.data, { decodeEntities: true, normalizeWhitespace: false });
        const selectors = [
            'article', '.post-content', '.entry-content', '.post-body', '.content', 
            '.question .s-prose', '.answer .s-prose', '.post-text', '.s-prose', 
            '.question-body', '#content', '.main-content', '[role="main"]'
        ];
        const contentElements = $(selectors.join(',')).first();
        const chunks = [];

        console.log('Raw content extracted:', contentElements.html()?.slice(0, 500) || 'No content');

        if (!contentElements.length) {
            console.warn('No content found in selectors for', url, '; falling back to body');
            const bodyHtml = $('body').html();
            if (bodyHtml) {
                const cleanedBody = cleanText(bodyHtml, $, false, false, true);
                if (cleanedBody) {
                    chunks.push({ type: 'paragraph', content: cleanedBody });
                }
            }
        } else {
            contentElements.contents().each((_, el) => {
                if (el.type === 'text') {
                    const text = $(el).text().trim();
                    if (text && !looksLikeCode(text)) {
                        const cleanedText = cleanText(`<p>${text}</p>`, $, false, false, true);
                        if (cleanedText) {
                            chunks.push({ type: 'paragraph', content: cleanedText });
                            console.log('Added text chunk as paragraph:', { type: 'paragraph', content: cleanedText.slice(0, 100) });
                        }
                    }
                } else if (el.type === 'tag') {
                    const tagName = el.name.toLowerCase();
                    const isHeading = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName);
                    const isParagraph = tagName === 'p' || ['ul', 'ol', 'li'].includes(tagName);
                    const isCodeContainer =
                        (tagName === 'pre' && $(el).find('code').length > 0 && isSupportedLanguage($(el).find('code').attr('class'))) ||
                        (tagName === 'code' && isSupportedLanguage($(el).attr('class'))) ||
                        (tagName === 'div' && ($(el).hasClass('code') || $(el).hasClass('code-block') || $(el).hasClass('highlight')) && isSupportedLanguage($(el).attr('class')));

                    if (isCodeContainer) {
                        let code = $(el).find('code').length > 0 ? $(el).find('code').html() : $(el).html();
                        code = code.replace(/<br\s*\/?>/gi, '\n');
                        code = cleanText(code, $, true);
                        const isPython = (languageId === 'python') || looksLikePython(code);
                        const isCOrCpp = (['c', 'cpp'].includes(languageId)) || looksLikeCOrCpp(code);
                        code = code.replace(/\r\n/g, '\n').trim();
                        if (code) {
                            const language = isPython ? 'python' : (isCOrCpp ? (languageId === 'cpp' ? 'cpp' : 'c') : (languageMap[languageId]?.prism || 'javascript'));
                            chunks.push({ type: 'code', content: code, language });
                            storedCodeSnippets.push(code);
                            console.log('Added code chunk:', { type: 'code', content: code.slice(0, 100), language });
                        }
                    } else if (isHeading) {
                        const elementHtml = $(el).toString();
                        const cleanedText = cleanText(elementHtml, $, false, true);
                        if (cleanedText) {
                            chunks.push({ type: 'heading', content: cleanedText, level: parseInt(tagName.replace('h', '')) });
                            console.log('Added heading chunk:', { type: 'heading', content: cleanedText.slice(0, 100), level: parseInt(tagName.replace('h', '')) });
                        }
                    } else if (isParagraph) {
                        const elementHtml = $(el).toString();
                        const cleanedText = cleanText(elementHtml, $, false, false, true);
                        if (cleanedText) {
                            chunks.push({ type: 'paragraph', content: cleanedText });
                            console.log('Added paragraph chunk:', { type: 'paragraph', content: cleanedText.slice(0, 100) });
                        }
                    } else if (tagName === 'pre' && !isCodeContainer) {
                        const text = $(el).text().trim();
                        if (text && !looksLikeCode(text)) {
                            const cleanedText = cleanText(`<p>${text.replace(/\n/g, '<br>')}</p>`, $, false, false, true);
                            if (cleanedText) {
                                chunks.push({ type: 'paragraph', content: cleanedText });
                                console.log('Added pre chunk as paragraph:', { type: 'paragraph', content: cleanedText.slice(0, 100) });
                            }
                        } else if (text) {
                            const cleanedText = cleanText(text, $, true);
                            const isPython = (languageId === 'python') || looksLikePython(text);
                            const isCOrCpp = (['c', 'cpp'].includes(languageId)) || looksLikeCOrCpp(text);
                            const language = isPython ? 'python' : (isCOrCpp ? (languageId === 'cpp' ? 'cpp' : 'c') : (languageMap[languageId]?.prism || 'javascript'));
                            chunks.push({ type: 'code', content: cleanedText, language });
                            storedCodeSnippets.push(cleanedText);
                            console.log('Added pre chunk as code:', { type: 'code', content: cleanedText.slice(0, 100), language });
                        }
                    } else {
                        const elementHtml = $(el).html();
                        if (elementHtml) {
                            const codeBlocks = $(el).find('pre > code[class*="language-"], code[class*="language-"], div.code[class*="language-"], div.code-block[class*="language-"]');
                            if (codeBlocks.length > 0) {
                                let remainingHtml = elementHtml;
                                codeBlocks.each((_, codeEl) => {
                                    const codeClass = $(codeEl).attr('class');
                                    if (!isSupportedLanguage(codeClass)) {
                                        console.log('Skipping code block with unsupported language:', codeClass);
                                        const textContent = $(codeEl).text().trim();
                                        if (textContent && !looksLikeCode(textContent)) {
                                            const cleanedText = cleanText(`<p>${textContent}</p>`, $, false, false, true);
                                            if (cleanedText) {
                                                chunks.push({ type: 'paragraph', content: cleanedText });
                                                console.log('Added unsupported code as paragraph:', { type: 'paragraph', content: cleanedText.slice(0, 100) });
                                            }
                                        }
                                        return;
                                    }
                                    let codeText = $(codeEl).html();
                                    codeText = codeText.replace(/<br\s*\/?>/gi, '\n');
                                    codeText = cleanText(codeText, $, true);
                                    const isPython = (languageId === 'python') || looksLikePython(codeText);
                                    const isCOrCpp = (['c', 'cpp'].includes(languageId)) || looksLikeCOrCpp(codeText);
                                    codeText = codeText.replace(/\r\n/g, '\n').trim();
                                    if (codeText) {
                                        const codeOuterHtml = $(codeEl).toString();
                                        const splitIndex = remainingHtml.indexOf(codeOuterHtml);
                                        if (splitIndex > 0) {
                                            const textBefore = remainingHtml.substring(0, splitIndex).trim();
                                            if (textBefore && !looksLikeCode(textBefore)) {
                                                const cleanedText = cleanText(`<p>${textBefore}</p>`, $, false, false, true);
                                                if (cleanedText) {
                                                    chunks.push({ type: 'paragraph', content: cleanedText });
                                                    console.log('Added text before code as paragraph:', { type: 'paragraph', content: cleanedText.slice(0, 100) });
                                                }
                                            }
                                        }
                                        const language = isPython ? 'python' : (isCOrCpp ? (languageId === 'cpp' ? 'cpp' : 'c') : (languageMap[languageId]?.prism || 'javascript'));
                                        chunks.push({ type: 'code', content: codeText, language });
                                        storedCodeSnippets.push(codeText);
                                        console.log('Added nested code chunk:', { type: 'code', content: codeText.slice(0, 100), language });
                                        remainingHtml = remainingHtml.substring(splitIndex + codeOuterHtml.length);
                                    }
                                });
                                if (remainingHtml.trim()) {
                                    const remainingText = cheerio.load(remainingHtml, { decodeEntities: true }).text().trim();
                                    if (remainingText && !looksLikeCode(remainingText)) {
                                        const cleanedText = cleanText(`<p>${remainingHtml.trim()}</p>`, $, false, false, true);
                                        if (cleanedText) {
                                            chunks.push({ type: 'paragraph', content: cleanedText });
                                            console.log('Added remaining chunk as paragraph:', { type: 'paragraph', content: cleanedText.slice(0, 100) });
                                        }
                                    }
                                }
                            } else {
                                const text = $(el).text().trim();
                                if (text && !looksLikeCode(text)) {
                                    const cleanedText = cleanText(`<p>${text}</p>`, $, false, false, true);
                                    if (cleanedText) {
                                        chunks.push({ type: 'paragraph', content: cleanedText });
                                        console.log('Added non-code element chunk as paragraph:', { type: 'paragraph', content: cleanedText.slice(0, 100) });
                                    }
                                }
                            }
                        }
                    }
                }
            });

            if (!chunks.length) {
                const textContent = contentElements.html();
                if (textContent) {
                    const text = cheerio.load(textContent, { decodeEntities: true }).text().trim();
                    if (text && !looksLikeCode(text)) {
                        const cleanedText = cleanText(`<p>${textContent}</p>`, $, false, false, true);
                        if (cleanedText) {
                            chunks.push({ type: 'paragraph', content: cleanedText });
                            console.log('Added fallback chunk as paragraph:', { type: 'paragraph', content: cleanedText.slice(0, 100) });
                        }
                    }
                }
            }
        }

        if (!chunks.length) {
            console.error('No content available for', url);
            webview.postMessage({
                command: 'error',
                message: 'No content could be extracted from this page.'
            });
            return signatures;
        }

        const updatedSignatures = signatures.map(signature => {
            const signatureCode = signature.fullCode?.trim();
            if (!signatureCode) return signature;
            const normalizedSignatureCode = normalizeCode(signatureCode);
            const exactMatch = storedCodeSnippets.find(snippet => normalizeCode(snippet) === normalizedSignatureCode);
            if (exactMatch) {
                console.log('Exact match found for signature:', signature.signature);
                return { ...signature, fullCode: exactMatch.slice(0, 2000) };
            }
            const matchingSnippet = storedCodeSnippets.find(snippet => normalizeCode(snippet).includes(normalizedSignatureCode));
            if (matchingSnippet) {
                console.log('Substring match found for signature:', signature.signature, 'Replacing with:', matchingSnippet.slice(0, 100) + '...');
                return { ...signature, fullCode: matchingSnippet.slice(0, 2000) };
            }
            console.log('No match found for signature:', signature.signature);
            return signature;
        });

        console.log('Total chunks to send:', chunks.length);
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            console.log('Sending chunk', i + 1, 'of', chunks.length, 'type:', chunk.type, 'language:', chunk.language || 'text', ':', chunk.content.slice(0, 50) + '...');
            webview.postMessage({
                command: 'showPost',
                content: chunk.content,
                type: chunk.type,
                language: chunk.language,
                headingLevel: chunk.level,
                url,
                isFirstChunk: i === 0,
                isLastChunk: i === chunks.length - 1
            });
            await new Promise(resolve => setTimeout(resolve, 10));
        }

        return updatedSignatures;
    } catch (error) {
        console.error('Failed to fetch content for', url, ':', error.stack);
        let errorMessage = `Failed to load content: ${error.message}`;
        if (error.response && error.response.status === 403) {
            errorMessage = 'Access denied (403 Forbidden). Try opening the link in a browser.';
        }
        webview.postMessage({
            command: 'error',
            message: errorMessage
        });
        return signatures;
    }
}

module.exports = {
    activate,
    deactivate
};