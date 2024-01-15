const FLOW_DIRECTION = 'flow-direction';
const LEFT_TO_RIGHT = 'left-to-right';
const RIGHT_TO_LEFT = 'right-to-left';

// See https://html.spec.whatwg.org/multipage/common-dom-interfaces.html ↵
// #reflecting-content-attributes-in-idl-attributes.

const installStringReflection = (obj, attrName, propName = attrName) => {
  Object.defineProperty(obj, propName, {
    enumerable: true,
    get() {
      const value = this.getAttribute(attrName);
      return value === null ? '' : value;
    },
    set(v) {
      this.setAttribute(attrName, v);
    },
  });
};

/*
const installBoolReflection = (obj, attrName, propName = attrName) => {
  Object.defineProperty(obj, propName, {
    enumerable: true,
    get() {
      return this.hasAttribute(attrName);
    },
    set(v) {
      if (v) {
        this.setAttribute(attrName, '');
      } else {
        this.removeAttribute(attrName);
      }
    },
  });
};
*/

const template = window.document.createElement('template');

template.innerHTML = `
<style>
  .rainbow-character {
    --char-percent-complement: calc(1 - var(--character-percent, 0.25));
    color: hsl(calc(360deg * var(--char-percent-complement)), 90%, 65%);
    animation-name: rainbow-colors;
    animation-duration: var(--animation-duration, 2s);
    animation-timing-function: var(--animation-timing-function, linear);
    animation-iteration-count: var(--animation-iteration-count, infinite);
    animation-direction: var(--animation-direction, normal);
    animation-fill-mode: var(--animation-fill-mode, none);
    animation-play-state: var(--animation-play-state, running);
    animation-delay: calc(var(--animation-duration, 2s) * var(--flow-direction, -1) * var(--char-percent-complement));
  }

  /* Unfortunately, browsers try to take the shortest distance between transition/animation properties, so a simple "0turn" to "1turn" doesn't get the proper effect. */
  @keyframes rainbow-colors {
    0% {
        color: hsl(0turn, 90%, 65%);
    }

    25% {
        color: hsl(0.25turn, 90%, 65%);
    }

    50% {
        color: hsl(0.5turn, 90%, 65%);
    }

    75% {
        color: hsl(0.75turn, 90%, 65%);
    }

    100% {
        color: hsl(1turn, 90%, 65%);
    }
  }
</style>
<span part="rainbow-text-container"></span>
`;

export class RainbowText extends HTMLElement {
  static get observedAttributes() {
    return [FLOW_DIRECTION];
  }

  #rainbowTextContainer = null;
  #observer = null;

  constructor() {
    super();

    installStringReflection(this, FLOW_DIRECTION);
    this.#initializeDOM();
  }

  #initializeDOM() {
    const shadowRoot = this.attachShadow({mode: 'open'});
    shadowRoot.append(template.content.cloneNode(true));

    this.#rainbowTextContainer = shadowRoot.querySelector('[part=rainbow-text-container]');
  }

  #renderNodesOrCharacter(nodesOrCharacters) {
    return nodesOrCharacters.map(
      (nodeOrCharacter, index) => {
        const characterElement = window.document.createElement('span');
        characterElement.classList.add('rainbow-character');
        if (nodeOrCharacter instanceof Node) {
          characterElement.appendChild(nodeOrCharacter);
        } else {
          characterElement.innerText = nodeOrCharacter;
        }
        return characterElement;
      }
    );
  }

  #renderChildNodes(childNodes) {
    const renderedChildNodes = [];
    for (const childNode of childNodes) {
      if (childNode.nodeType ===  Node.TEXT_NODE) {
        renderedChildNodes.push(...this.#renderNodesOrCharacter(childNode.textContent.split('')));
      } else if (childNode.nodeType ===  Node.ELEMENT_NODE && (childNode.tagName !== 'LINK' && childNode.tagName !== 'STYLE')) {
        // Technically we should be able to handle any element that works with "color" CSS property, for example font awesome
        renderedChildNodes.push(...this.#renderNodesOrCharacter([childNode.cloneNode()]));
      } else {
        // Do nothing, this should handle <link> and <style> elements
        renderedChildNodes.push(childNode.cloneNode(true));
      }
    }
    // recalculate index
    const characterElements = renderedChildNodes.filter(renderedChildNode => renderedChildNode.classList.contains('rainbow-character'));
    characterElements.forEach((characterElement, index) => {
      characterElement.style.setProperty(
        '--character-percent',
        index / characterElements.length
      );
    });
    return renderedChildNodes;
  }

  #renderInnerContent() {
    if (this.#rainbowTextContainer instanceof HTMLElement) {
      while (this.#rainbowTextContainer.lastChild !== null) {
        this.#rainbowTextContainer.removeChild(this.#rainbowTextContainer.lastChild);
      }
      const renderedChildNodes = this.#renderChildNodes(this.childNodes);
      for (const renderedChildNode of renderedChildNodes) {
        this.#rainbowTextContainer.appendChild(renderedChildNode);
      }
    }
  }

  #disconnectObserver() {
    if (this.#observer) {
      this.#observer.disconnect();
      this.#observer = null;
    }
  }

  #connectObserver() {
    this.#disconnectObserver();
    const observerConfig = {
      childList: true
    };
    this.#observer = new MutationObserver((mutationsList) => {
      if (
        Array.from(mutationsList).some(mutation => mutation.type === 'childList') &&
          this.childNodes.length > 0
      ) {
        // disconnect to avoid recursive call
        this.#observer.disconnect();
        this.#renderInnerContent();
        // resume observer
        this.#observer.observe(
          this,
          observerConfig
        );
      }
    });
    this.#observer.observe(
      this,
      observerConfig
    );
  }

  connectedCallback() {
    if (this.#rainbowTextContainer instanceof HTMLElement) {
      this.#connectObserver();
    }
    this.#renderInnerContent();
  }

  disconnectedCallback() {
    this.#disconnectObserver();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === FLOW_DIRECTION) {
      switch (newValue) {
        case LEFT_TO_RIGHT:
          this.#rainbowTextContainer.style.setProperty(
            '--flow-direction',
            -1
          );
          break;
        case RIGHT_TO_LEFT:
          this.#rainbowTextContainer.style.setProperty(
            '--flow-direction',
            1
          );
          break;
        default:
          throw new RangeError(`Invalid newValue: ${newValue} supplied to ${name} attribute, possible values are [${[LEFT_TO_RIGHT, RIGHT_TO_LEFT]}].`);
      }
    }
  }
}

customElements.define('rainbow-text', RainbowText);