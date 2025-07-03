## Scout 2.0

Scout 2.0 is a Visual Studio Code extension that brings context-aware API signature discovery directly into your editor. By leveraging web search and intelligent ranking, Scout 2.0 helps you find and insert relevant code snippets and API signatures across multiple programming languages without leaving VS Code.

---

### 🔍 Features

- **Multi-language Support**: Extracts context terms and discovers API signatures for JavaScript, TypeScript, Python, C, and C++.
- **Context Extraction**:
  - **JavaScript/TypeScript**: Uses [Esprima](https://github.com/jquery/esprima) to parse ASTs and identify functions, parameters, and imports.
  - **Python, C, C++**: Applies lightweight regular expressions to capture relevant context terms from your code.
- **Web Search Integration**: Queries SerpAPI to fetch structured search results for code examples, error solutions, and API documentation.
- **Rich Content Extraction**: Scrapes headings, paragraphs, and code blocks using [Cheerio](https://github.com/cheeriojs/cheerio) for detailed result presentation.
- **Intelligent Ranking**:
  - +1 point for each context term match in a signature  
  - +3 points for accepted answers  
  - +2 points for top-voted answers  
  - +1 point for recent entries  
- **Interactive Webview Panel**:
  - Displays ranked API signatures and usage examples in a clean UI.
  - Includes a **Copy** button for each code block with confirmation feedback.
- **Extensible Architecture**:
  - Built on the VS Code Extension API for seamless editor integration.
  - Modular design for easy addition of new languages or ranking heuristics.

---

### 🚀 Installation

1. Open VS Code and go to the **Extensions** view (`Ctrl+Shift+X` / `⇧⌘X`).
2. Search for **"Scout 2.0"** and click **Install**.
3. Reload VS Code when prompted.

---

### ⚙️ Usage

1. Open any code file (JavaScript, TypeScript, Python, C, or C++).
2. Place your cursor on a function name, error message, or API call.
3. Press `Ctrl+Shift+P` (or `⇧⌘P` on Mac) and select **Scout: Search API Signatures**.
4. Scout 2.0 will open a webview panel showing ranked signatures and examples.
5. Click the **Copy** button to insert the desired code snippet directly into your editor.

---

### 🛠 Technology Stack

- **VS Code API**: Integrates the extension with the editor and webview panels.
- **JavaScript/TypeScript**: Core logic for event handling, context parsing, and webview communication.
- **Axios**: HTTP client for fetching search results from SerpAPI and webpage content.
- **Cheerio**: HTML parser for extracting headings, paragraphs, and code chunks from search results.
- **Esprima**: JavaScript parser for AST-based context extraction in JS/TS code.
- **SerpAPI**: Structured search API for retrieving relevant web results.

---

### ⚠️ Limitations

- **Error Localization**: Scout surfaces related posts and signatures but does not automatically pinpoint exact code errors; manual review is required.
- **Scraping Fragility**: Web scraping can be affected by dynamic content, layout changes, and anti-bot measures (CAPTCHAs).
- **Access Restrictions**: Content behind paywalls or requiring authentication may not be retrievable.

---

