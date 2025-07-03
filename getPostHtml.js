function getPostHtml() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Post Content</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-okaidia.min.css" rel="stylesheet" />
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            padding: 20px;
            background: #fff;
            color: #333;
        }
        #postContent pre {
            position: relative;
            white-space: pre-wrap;
            font-size: 13px;
            margin: 8px 0;
            padding: 12px;
            background: rgba(30, 30, 30, 0.9);
            border: 1px solid #444;
            border-radius: 4px;
            overflow-x: auto;
            color: #f8f8f2;
        }
        #postContent p {
            font-size: 14px;
            margin: 8px 0;
        }
        #postContent h1, #postContent h2, #postContent h3, #postContent h4, #postContent h5, #postContent h6 {
            margin: 10px 0;
            font-weight: bold;
        }
        #postContent h1 { font-size: 24px; }
        #postContent h2 { font-size: 20px; }
        #postContent h3 { font-size: 18px; }
        #postContent h4 { font-size: 16px; }
        #postContent h5 { font-size: 14px; }
        #postContent h6 { font-size: 12px; }
        #postContent ul, #postContent ol {
            margin: 8px 0;
            padding-left: 20px;
        }
        #postContent li {
            margin: 4px 0;
        }
        #postContent strong {
            font-weight: bold;
        }
        #postContent em {
            font-style: italic;
        }
        #postContent code {
            background: rgba(240, 240, 240, 0.8);
            padding: 2px 4px;
            border-radius: 3px;
            color: #333;
        }
        #postContent pre code {
            background: transparent;
            padding: 0;
            color: inherit;
        }
        .loading {
            color: #007acc;
            font-style: italic;
        }
        a {
            color: #007acc;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
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
    <div id="postContent"><p class="loading">Loading content...</p></div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-javascript.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-python.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-markup.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-css.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-typescript.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-c.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-cpp.min.js"></script>
    <script>
        const vscode = acquireVsCodeApi();

        function escapeHtml(text) {
            if (typeof text !== 'string') return '';
            return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
        }

        window.addEventListener('load', () => {
            console.log('Post panel loaded');
            vscode.postMessage({ command: 'ready' });
        });

window.addEventListener('message', event => {
    const message = event.data;
    console.log('Post panel received message:', message);
    try {
        if (message.command === 'showPost') {
            const postContentDiv = document.getElementById('postContent');
            if (!postContentDiv) {
                console.error('postContent div not found');
                return;
            }
            if (message.isFirstChunk) {
                postContentDiv.innerHTML = '';
            }
            if (typeof message.content !== 'string' || !message.content.trim()) {
                console.warn('Empty or invalid content received');
                return;
            }
            if (message.type === 'code') {
                const preElement = document.createElement('pre');
                const language = message.language || 'javascript';
                preElement.className = 'language-' + language;
                preElement.innerHTML = '<code class="language-' + language + '">' + escapeHtml(message.content) + '</code>';
                try {
                    Prism.highlightElement(preElement.querySelector('code'));
                } catch (e) {
                    console.error('Prism highlighting error:', e);
                    preElement.textContent = message.content;
                }
                const copyButton = document.createElement('button');
                copyButton.className = 'copy-button';
                copyButton.textContent = 'Copy';
                copyButton.addEventListener('click', () => {
                    navigator.clipboard.writeText(message.content).then(() => {
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
                postContentDiv.appendChild(preElement);
            } else if (message.type === 'output') {
                const divElement = document.createElement('div');
                divElement.className = 'output';
                divElement.innerHTML = message.content;
                postContentDiv.appendChild(divElement);
            } else {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = message.content;
                Array.from(tempDiv.childNodes).forEach(node => {
                    postContentDiv.appendChild(node);
                });
            }
            if (message.isLastChunk) {
                const existingLoading = postContentDiv.querySelector('.loading');
                if (existingLoading) existingLoading.remove();
                const link = document.createElement('a');
                link.href = message.url || '#';
                link.target = '_blank';
                link.textContent = 'Open in Browser';
                postContentDiv.appendChild(link);
            }
        } else if (message.command === 'error') {
            console.log('Received error:', message.message);
            document.getElementById('postContent').innerHTML = '<p>Error: ' + escapeHtml(message.message || 'Unknown error') + '</p>';
        }
    } catch (error) {
        console.error('Error processing message:', error);
        document.getElementById('postContent').innerHTML = '<p>Error rendering content: ' + escapeHtml(error.message) + '</p>';
    }
});
    </script>
</body>
</html>`;
}

module.exports = { getPostHtml };