import { LitElement, html, css } from 'lit';
import { A2uiMessageProcessor } from '@a2ui/lit/0.8';
import { create as createSignalProcessor } from '@a2ui/lit/0.8/data/signal-model-processor.js';
import '@a2ui/lit/0.8/ui/ui.js';

const processor = createSignalProcessor();

// A2UI surface — this is what an AI agent generates
const messages = [
  {
    dataModelUpdate: {
      surfaceId: "main",
      path: "/",
      contents: [
        { key: "name", valueString: "" },
        { key: "email", valueString: "" },
        { key: "role", valueString: "" },
        { key: "result", valueString: "" }
      ]
    }
  },
  {
    surfaceUpdate: {
      surfaceId: "main",
      components: [
        {
          id: "root",
          component: {
            Column: {
              children: { explicitList: ["title", "card"] }
            }
          }
        },
        {
          id: "title",
          component: {
            Text: { text: { literalString: "A2UI Agent-Generated Form" }, usageHint: "h2" }
          }
        },
        {
          id: "card",
          component: {
            Card: {
              children: { explicitList: ["nameField", "emailField", "roleField", "submitBtn", "resultText"] }
            }
          }
        },
        {
          id: "nameField",
          component: {
            TextField: { label: { literalString: "Name" }, text: { path: "/name" } }
          }
        },
        {
          id: "emailField",
          component: {
            TextField: { label: { literalString: "Email" }, text: { path: "/email" } }
          }
        },
        {
          id: "roleField",
          component: {
            MultipleChoice: {
              label: { literalString: "Role" },
              selections: { path: "/role" },
              options: [
                { label: { literalString: "Developer" }, value: { literalString: "dev" } },
                { label: { literalString: "Designer" }, value: { literalString: "design" } },
                { label: { literalString: "Manager" }, value: { literalString: "manager" } }
              ]
            }
          }
        },
        {
          id: "submitBtn",
          component: {
            Button: { child: "btnLabel", action: { name: "submit" } }
          }
        },
        {
          id: "btnLabel",
          component: {
            Text: { text: { literalString: "Submit" } }
          }
        },
        {
          id: "resultText",
          component: {
            Text: { text: { path: "/result" } }
          }
        }
      ]
    }
  }
];

// Process messages
processor.processMessages(messages);

class A2uiDemo extends LitElement {
  static styles = css`
    :host { display: block; font-family: system-ui; padding: 1rem; color: #eee; background: #111; min-height: 100vh; }
    h2 { color: #00d4aa; }
    .desc { color: #888; font-size: 0.85rem; margin-bottom: 1rem; }
    .info { color: #888; font-size: 0.75rem; margin-top: 2rem; }
    pre { background: #1a1a2e; padding: 0.5rem; border-radius: 8px; font-size: 0.7rem; overflow: auto; max-height: 200px; }
  `;

  render() {
    const surfaces = processor.getSurfaces();
    if (surfaces.size === 0) return html`<p>Loading...</p>`;

    const surface = surfaces.get("main");

    return html`
      <h2>${"\u{1F916}"} A2UI: Agent-to-User Interface</h2>
      <p class="desc">Google's protocol — AI agent generates JSON, Lit web components render natively.</p>

      <a2ui-surface .surfaceId=${"main"} .processor=${processor} .surface=${surface}></a2ui-surface>

      <details class="info">
        <summary>What the AI agent sent (A2UI JSON)</summary>
        <pre>${JSON.stringify(messages[1], null, 2)}</pre>
      </details>
    `;
  }
}

customElements.define('a2ui-demo', A2uiDemo);

const root = document.getElementById('root');
root.innerHTML = '<a2ui-demo></a2ui-demo>';
