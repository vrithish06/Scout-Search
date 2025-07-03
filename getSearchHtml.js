function getSearchHtml() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Scout Search</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-okaidia.min.css" rel="stylesheet" />
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            padding: 20px;
            background: #fff;
            color: #333;
            line-height: 1.6;
        }
        h2 {
            margin-bottom: 20px;
            font-size: 24px;
            color: #333;
        }
        h3 {
            margin-bottom: 15px;
            font-size: 18px;
            color: #555;
        }
        input[type="text"] {
            width: 70%;
            padding: 10px;
            font-size: 14px;
            border: 1px solid #ddd;
            border-radius: 4px;
            margin-right: 10px;
            box-sizing: border-box;
        }
        button {
            padding: 10px 15px;
            font-size: 14px;
            background: #007acc;
            color: #fff;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: background 0.2s;
        }
        button:hover {
            background: #005f99;
        }
        #results {
            margin-top: 25px;
        }
        .result {
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid #eee;
        }
        .result a {
            color: #007acc;
            text-decoration: none;
            font-weight: bold;
            font-size: 16px;
        }
        .result a:hover {
            text-decoration: underline;
        }
        .result p.snippet {
            margin: 8px 0;
            color: #666;
            font-size: 14px;
            line-height: 1.5;
        }
        .tabs {
            display: flex;
            gap: 10px;
            margin-top: 10px;
            margin-bottom: 10px;
        }
        .tab {
            padding: 6px 12px;
            background: #e0e0e0;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            transition: background 0.2s;
        }
        .tab.active {
            background: #007acc;
            color: #fff;
        }
        .tab-content {
            margin-bottom: 15px;
        }
        .tab-content pre {
            background: #2d2d2d;
            padding: 10px;
            border-radius: 4px;
            font-size: 13px;
            white-space: pre-wrap;
            color: #f8f8f2;
            cursor: pointer;
            position: relative;
        }
        .tab-content pre:hover::after {
            content: 'Click to expand/collapse';
            position: absolute;
            bottom: 5px;
            right: 10px;
            font-size: 11px;
            color: #aaa;
        }
        .full-post-link {
            color: #007acc;
            text-decoration: none;
            font-size: 14px;
            display: inline-block;
            margin-top: 10px;
        }
        .full-post-link:hover {
            text-decoration: underline;
        }
        .full-post-link.disabled {
            color: #888;
            cursor: not-allowed;
            pointer-events: none;
        }
        .error {
            color: #d00;
            font-weight: bold;
        }
        .copy-button {
            position: absolute;
            top: 8px;
            right: 8px;
            background: #007acc;
            color: #fff;
            border: none;
            border-radius: 3px;
            padding: 4px 8px;
            font-size: 12px;
            cursor: pointer;
            opacity: 0.8;
            transition: opacity 0.2s;
        }
        .copy-button:hover {
            opacity: 1;
        }
        .copy-button.copied {
            background: #28a745;
        }
    </style>
</head>
<body>
    <h2>Search Code Help</h2>
    <input type="text" id="searchInput" placeholder="Enter your query..." />
    <button id="searchButton" onclick="search()">Search</button>
    <div id="results"></div>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-javascript.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-python.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-markup.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-css.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-typescript.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-c.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-cpp.min.js"></script>
    <script>
        console.log('Webview script starting');
        try {
            const vscode = acquireVsCodeApi();
            console.log('VS Code API acquired');
            let isLoadingPost = false;

            function search() {
                console.log('Search function called');
                try {
                    const searchInput = document.getElementById('searchInput');
                    const resultsDiv = document.getElementById('results');
                    console.log('DOM elements:', { searchInput: !!searchInput, resultsDiv: !!resultsDiv });
                    if (!searchInput || !resultsDiv) {
                        console.error('DOM elements missing');
                        resultsDiv.innerHTML = '<p class="error">Error: Search input or results div not found.</p>';
                        return;
                    }
                    const query = searchInput.value.trim();
                    console.log('Query:', query);
                    if (!query) {
                        console.warn('Empty query');
                        resultsDiv.innerHTML = '<p class="error">Please enter a search query.</p>';
                        return;
                    }
                    resultsDiv.innerHTML = '<p>Searching...</p>';
                    vscode.postMessage({ command: 'search', text: query });
                    console.log('Posted message:', { command: 'search', text: query });
                } catch (error) {
                    console.error('Search error:', error.message, error.stack);
                    document.getElementById('results').innerHTML = '<p class="error">Search failed: ' + error.message + '</p>';
                }
            }

            function escapeHtml(str) {
                return str
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;');
            }

            function openPost(url, linkElement) {
                console.log('Opening post:', url);
                try {
                    if (isLoadingPost) {
                        console.log('Post loading in progress, ignoring');
                        return;
                    }
                    isLoadingPost = true;
                    linkElement.classList.add('disabled');
                    vscode.postMessage({ command: 'openPostInNewPanel', url });
                    setTimeout(() => {
                        isLoadingPost = false;
                        linkElement.classList.remove('disabled');
                        console.log('Re-enabled link:', url);
                    }, 1000);
                } catch (error) {
                    console.error('Open post error:', error.message);
                    isLoadingPost = false;
                    linkElement.classList.remove('disabled');
                }
            }
            
            function addCopyButtons() {
                console.log('Adding copy buttons to code blocks');
                document.querySelectorAll('.tab-content pre').forEach((preElement, index) => {
                    if (preElement.querySelector('.copy-button')) return;
                    const fullCode = preElement.dataset.fullCode || preElement.textContent;
                    const copyButton = document.createElement('button');
                    copyButton.className = 'copy-button';
                    copyButton.textContent = 'Copy';
                    copyButton.addEventListener('click', () => {
                        navigator.clipboard.writeText(fullCode).then(() => {
                            copyButton.textContent = 'Copied!';
                            copyButton.className = 'copy-button copied';
                            setTimeout(() => {
                                copyButton.textContent = 'Copy';
                                copyButton.className = 'copy-button';
                            }, 2000);
                        }).catch(err => {
                            console.error('Failed to copy:', err);
                        });
                    });
                    preElement.appendChild(copyButton);
                });
            }

            window.switchTab=function switchTab(signatureId, tab) {
          
                console.log('Switching tab:', signatureId, tab);
                const usageTab = document.getElementById(\`usage-tab-\${signatureId}\`);
                const codeTab = document.getElementById(\`code-tab-\${signatureId}\`);
                const usageContent = document.getElementById(\`usage-content-\${signatureId}\`);
                const codeContent = document.getElementById(\`code-content-\${signatureId}\`);
                if (usageTab && codeTab && usageContent && codeContent) {
                    if (tab === 'usage') {
                        usageTab.classList.add('active');
                        codeTab.classList.remove('active');
                        usageContent.style.display = 'block';
                        codeContent.style.display = 'none';
                        
                    } else {
                        
                        usageTab.classList.remove('active');
                        codeTab.classList.add('active');
                        usageContent.style.display = 'none';
                        codeContent.style.display = 'block';
                        const preElement = codeContent.querySelector('pre');
                        const signature = preElement.dataset.signature;
                      
                        preElement.dataset.isExpanded = 'false';
                        const codeElement = preElement.querySelector('code');
                        if (codeElement) {
                            codeElement.textContent = signature;
                            Prism.highlightElement(codeElement);
                        }

                        addCopyButtons();
                    }
                } else {
                    console.error('Tab elements missing for:', signatureId);
                }
            }

         function toggleCodeBlock(signatureId) {
    console.log('Toggling code block for:', signatureId)
    const codeContent = document.getElementById(\`code-content-\${signatureId}\`);
    const preElement = codeContent.querySelector('pre');
    const isExpanded = preElement.dataset.isExpanded === 'true';
    const fullCode = preElement.dataset.fullCode;
    const signature = preElement.dataset.signature;
    const codeElement = preElement.querySelector('code');

    if (isExpanded) {
        codeElement.textContent = signature;
        preElement.dataset.isExpanded = 'false';
    } else {
        codeElement.textContent = fullCode;
        preElement.dataset.isExpanded = 'true';
    }

    Prism.highlightElement(codeElement);
    addCopyButtons();
}




            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.addEventListener('keypress', (event) => {
                    if (event.key === 'Enter') {
                        console.log('Enter key pressed');
                        search();
                    }
                });
                console.log('Enter key listener added');
            } else {
                console.error('Search input not found');
            }

            const searchButton = document.getElementById('searchButton');
            if (searchButton) {
                searchButton.addEventListener('click', () => {
                    console.log('Search button clicked');
                    search();
                });
                console.log('Button click listener added');
            } else {
                console.error('Search button not found');
            }

            window.addEventListener('message', (event) => {
                const message = event.data;
                console.log('Webview received:', message);
                try {
                    const resultsDiv = document.getElementById('results');
                    if (!resultsDiv) {
                        console.error('Results div not found');
                        return;
                    }
                    if (message.command === 'results') {
                        console.log('Rendering results:', message.results.length, 'with signatures');
                        resultsDiv.innerHTML = '<h3>Results for: "' + escapeHtml(message.query) + '"</h3>';
                        message.results.forEach((r, i) => {
                            const signaturesHtml = (r.signatures || []).map((sig, idx) => {
                                const escapedUsage = escapeHtml(sig.usageExample || 'No usage example available');
                                const escapedCode = escapeHtml(sig.fullCode || 'No full code available');
                                const escapedSignature = escapeHtml(sig.signature || 'No signature available');
                                const language = sig.language || 'javascript';
                                const sigId = \`\${i}-\${idx}\`;
                                return \`
                                    <div class="tabs">
                                        <div class="tab active" id="usage-tab-\${sigId}" onclick="switchTab('\${sigId}', 'usage')">Usage</div>
                                        <div class="tab" id="code-tab-\${sigId}" onclick="switchTab('\${sigId}', 'code')">Code</div>
                                    </div>
                                    <div class="tab-content" id="usage-content-\${sigId}" style="display: block;">
                                        <pre class="language-\${language}"><code class="language-\${language}">\${escapedUsage}</code></pre>
                                    </div>
                                    <div class="tab-content" id="code-content-\${sigId}" style="display: none;">
                                        <pre class="language-\${language}" onclick="toggleCodeBlock('\${sigId}')" data-full-code="\${escapedCode}" data-signature="\${escapedSignature}" data-is-expanded="false"><code class="language-\${language}">\${escapedSignature}</code></pre>
                                    </div>
                                \`;
                            }).join('');
                            resultsDiv.innerHTML += \`
                                <div class="result">
                                    <a href="\${escapeHtml(r.link)}" target="_blank">\${i + 1}. \${escapeHtml(r.title)}</a>
                                    <p class="snippet">\${escapeHtml(r.snippet)}</p>
                                    \${signaturesHtml}
                                    <a href="#" class="full-post-link" onclick="openPost('\${escapeHtml(r.link)}', this)">View Full Post</a>
                                </div>
                            \`;
                            Prism.highlightAll();
                           
                        });
                    } else if (message.command === 'error') {
                        console.error('Error:', message.message);
                        resultsDiv.innerHTML = '<p class="error">Error: ' + escapeHtml(message.message) + '</p>';
                    } else if (message.command === 'postPanelReady') {
                        console.log('Post panel ready');
                        isLoadingPost = false;
                        document.querySelectorAll('.full-post-link').forEach(el => el.classList.remove('disabled'));
                    } else {
                        console.warn('Unknown command:', message.command);
                    }
                } catch (error) {
                    console.error('Message error:', error.message, error.stack);
                    resultsDiv.innerHTML = '<p class="error">Error: ' + error.message + '</p>';
                }
            });

            console.log('Webview script loaded');
        } catch (error) {
            console.error('Webview init error:', error.message, error.stack);
            document.getElementById('results').innerHTML = '<p class="error">Webview failed: ' + error.message + '</p>';
        }
    </script>
</body>
</html>`;
}

module.exports = { getSearchHtml };