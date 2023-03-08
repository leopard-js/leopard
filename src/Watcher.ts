import Color from "./Color";

type WatcherValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | (string | number | boolean | null | undefined)[];

type WatcherStyle = "normal" | "large" | "slider";

type WatcherOptions = {
  value?: () => WatcherValue;
  setValue?: (value: number) => void;
  label: string;
  style?: WatcherStyle;
  visible?: boolean;
  color?: Color;
  step?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

export default class Watcher {
  value: () => WatcherValue;
  setValue: (value: number) => void;
  _previousValue: unknown | symbol;
  color: Color;
  _label!: string;
  _x!: number;
  _y!: number;
  _width: number | undefined;
  _height: number | undefined;
  _min!: number;
  _max!: number;
  _step!: number;
  _style!: WatcherStyle;
  _visible!: boolean;

  _dom!: {
    node: HTMLElement;
    label: HTMLElement;
    value: HTMLElement;
    slider: HTMLInputElement;
  };

  constructor({
    value = () => "",
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    setValue = () => {},
    label,
    style = "normal",
    visible = true,
    color = Color.rgb(255, 140, 26),
    step = 1,
    min = 0,
    max = 100,
    x = -240,
    y = 180,
    width,
    height,
  }: WatcherOptions) {
    this.initializeDOM();

    this.value = value;
    this.setValue = setValue;
    this._previousValue = Symbol("NO_PREVIOUS_VALUE");

    this.label = label;
    this.style = style;
    this.visible = visible;
    this.color = color;
    this.step = step;
    this.min = min;
    this.max = max;

    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.min = 0;
    this.max = 100;
    this.step = 1;
  }

  initializeDOM(): void {
    const node = document.createElement("div");
    node.classList.add("leopard__watcher");

    const label = document.createElement("div");
    label.classList.add("leopard__watcherLabel");
    node.append(label);

    const value = document.createElement("div");
    value.classList.add("leopard__watcherValue");
    node.append(value);

    const slider = document.createElement("input");
    slider.type = "range";
    slider.classList.add("leopard__watcherSlider");

    slider.addEventListener("input", () => {
      this.setValue(Number(slider.value));
    });

    node.append(slider);

    this._dom = { node, label, value, slider };
  }

  updateDOM(renderTarget: HTMLElement): void {
    if (renderTarget && !renderTarget.contains(this._dom.node)) {
      renderTarget.append(this._dom.node);
    }

    if (!this.visible) return;

    const value = this.value();

    const isList = Array.isArray(value);
    this._dom.node.classList.toggle("leopard__watcher--list", isList);
    if (isList) {
      // Render like a list
      if (
        !Array.isArray(this._previousValue) ||
        JSON.stringify(value.map(String)) !==
          JSON.stringify(this._previousValue.map(String))
      ) {
        this._dom.value.innerHTML = "";
        for (const [index, item] of value.entries()) {
          const itemElem = document.createElement("div");
          itemElem.classList.add("leopard__watcherListItem");

          const indexElem = document.createElement("div");
          indexElem.classList.add("leopard__watcherListItemIndex");
          indexElem.innerText = String(index);

          const contentElem = document.createElement("div");
          contentElem.classList.add("leopard__watcherListItemContent");
          contentElem.innerText = String(item);

          itemElem.append(indexElem);
          itemElem.append(contentElem);
          this._dom.value.append(itemElem);
        }
      }
    } else {
      // Render like a normal variable
      if (value !== this._previousValue) {
        this._dom.value.innerText = String(value);
      }
    }

    if (isList) {
      this._previousValue = [...value];
    } else {
      this._previousValue = value;
    }

    // Set slider value
    if (this._style === "slider") {
      // TODO: handle non-numeric slider values
      this._dom.slider.value = String(value);
    }

    // Update color
    // (Needs to happen here rather than a setter because
    // mutation of color object is possible.)
    const textColor =
      this.color.r * 0.299 + this.color.g * 0.587 + this.color.b * 0.114 > 162
        ? "#000"
        : "#fff";
    this._dom.value.style.setProperty("--watcher-color", this.color.toString());
    this._dom.value.style.setProperty("--watcher-text-color", textColor);
  }

  get visible(): boolean {
    return this._visible;
  }
  set visible(visible) {
    this._visible = visible;
    this._dom.node.style.visibility = visible ? "visible" : "hidden";
  }

  get x(): number {
    return this._x;
  }
  set x(x) {
    this._x = x;
    this._dom.node.style.left = `${x - 240}px`;
  }

  get y(): number {
    return this._y;
  }
  set y(y) {
    this._y = y;
    this._dom.node.style.top = `${180 - y}px`;
  }

  get width(): number | undefined {
    return this._width;
  }
  set width(width) {
    this._width = width;
    if (width) {
      this._dom.node.style.width = `${width}px`;
    } else {
      this._dom.node.style.removeProperty("width");
    }
  }

  get height(): number | undefined {
    return this._height;
  }
  set height(height) {
    this._height = height;
    if (height) {
      this._dom.node.style.height = `${height}px`;
    } else {
      this._dom.node.style.removeProperty("height");
    }
  }

  get style(): WatcherStyle {
    return this._style;
  }
  set style(style) {
    this._style = style;
    this._dom.node.classList.toggle(
      "leopard__watcher--normal",
      style === "normal"
    );
    this._dom.node.classList.toggle(
      "leopard__watcher--large",
      style === "large"
    );
    this._dom.node.classList.toggle(
      "leopard__watcher--slider",
      style === "slider"
    );
  }

  get min(): number {
    return this._min;
  }
  set min(min: number) {
    this._min = min;
    this._dom.slider.min = String(min);
  }

  get max(): number {
    return this._max;
  }
  set max(max: number) {
    this._max = max;
    this._dom.slider.max = String(max);
  }

  get step(): number {
    return this._step;
  }
  set step(step) {
    this._step = step;
    this._dom.slider.step = String(step);
  }

  get label(): string {
    return this._label;
  }
  set label(label) {
    this._label = label;
    this._dom.label.innerText = label;
  }
}
