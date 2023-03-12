import type { Sprite, Stage } from "./Sprite";

type TriggerOption =
  | number
  | string
  | boolean
  | ((target: Sprite | Stage) => number | string | boolean);

type TriggerOptions = Partial<Record<string, TriggerOption>>;

// TODO: Remove symbol property. This is for support with old-style triggers.
// A unique function serves as a valid distinguisher and reduces the overall
// type footprint.
export type TriggerCreator =
  ((
    optionsOrScript: TriggerOptions | GeneratorFunction,
    script?: GeneratorFunction
  ) => Trigger)
    & {symbol: symbol};

export default class Trigger {
  // TODO: Expose as TriggerCreator instead of symbol.
  public trigger;

  private options: TriggerOptions;
  private _script: GeneratorFunction;
  private _runningScript: Generator | undefined;
  public done: boolean;
  private stop: () => void;

  protected static alertedDeprecatedSymbols: Set<Symbol> = new Set();

  public constructor(
    // TODO: Only accept TriggerCreator.
    trigger: symbol | TriggerCreator,
    optionsOrScript: TriggerOptions | GeneratorFunction,
    script?: GeneratorFunction
  ) {
    if (typeof trigger === "function") {
      this.trigger = trigger.symbol;
    } else {
      this.trigger = trigger;
    }

    if (typeof script === "undefined") {
      this.options = {};
      this._script = optionsOrScript as GeneratorFunction;
    } else {
      this.options = optionsOrScript as TriggerOptions;
      this._script = script;
    }

    // This is deliberately positioned after this.options is set.
    if (typeof trigger === "symbol") {
      this.warnDeprecatedConstructorSyntax();
    }

    this.done = false;
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    this.stop = () => {};
  }

  private warnDeprecatedConstructorSyntax() {
    const symbol = this.trigger;

    if (Trigger.alertedDeprecatedSymbols.has(symbol)) {
      return;
    } else {
      Trigger.alertedDeprecatedSymbols.add(symbol);
    }

    const topMessage = `Trigger.${symbol.description} syntax is deprecated - it'll be removed in a future version of Leopard.`;

    const triggerCreatorName = Object.entries(Object.getOwnPropertyDescriptors(Trigger))
      .find(([_key, { value }]) => typeof value === "function" && value.symbol === symbol)?.[0];

    if (!triggerCreatorName) {
      console.warn(topMessage + '.');
      return;
    }

    const stringifyOptions = () =>
      `{${
        Object.entries(this.options!)
          .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
          .join(', ')}}`;

    const triggerSyntax = Object.keys(this.options).length
      ? `Trigger.${triggerCreatorName}(${stringifyOptions()}, this.myScript)`
      : `Trigger.${triggerCreatorName}(this.myScript)`;

    console.warn(`${topMessage}\nUse the new syntax:  ${triggerSyntax}`);
  }

  public get isEdgeActivated(): boolean {
    return (
      this.trigger === Trigger.TIMER_GREATER_THAN ||
      this.trigger === Trigger.LOUDNESS_GREATER_THAN
    );
  }

  // Evaluate the given trigger option, whether it's a value or a function that
  // returns a value given a target
  public option(
    option: string,
    target: Sprite | Stage
  ): number | string | boolean | undefined {
    const triggerOption = this.options[option];
    // If the given option is a function, evaluate that function, passing in
    // the target that we're evaluating the trigger for
    if (typeof triggerOption === "function") {
      return triggerOption(target);
    }
    return triggerOption;
  }

  public matches(
    // TODO: Rework to not accept a symbol. Just compare to TriggerCreator.
    trigger: TriggerCreator | symbol,
    options?: Trigger["options"],
    target?: Sprite | Stage
  ): boolean {
    if (options && !target) {
      throw new Error("Expected target to check options against");
    }

    const triggerSymbol = (typeof trigger === "function" ? trigger.symbol : trigger);
    if (this.trigger !== triggerSymbol) return false;

    for (const option in options) {
      if (this.option(option, target!) !== options[option]) return false;
    }

    return true;
  }

  public start(target: Sprite | Stage): Promise<void> {
    this.stop();

    this.done = false;
    this._runningScript = this._script.call(target);

    return new Promise<void>((resolve) => {
      this.stop = (): void => {
        this.done = true;
        resolve();
      };
    });
  }

  public step(): void {
    if (!this._runningScript) return;
    this.done = !!this._runningScript.next().done;
    if (this.done) this.stop();
  }

  public clone(): Trigger {
    return new Trigger(this.trigger, this.options, this._script);
  }

  /**
   * Check if two TriggerCreators match. This interface is intended to be
   * agnostic to the Trigger class' internals.
   *
   * Note: This is not for matching actual Trigger instances against a
   * TriggerCreator. Use the trigger's own .matches() function, which accepts
   * additional options relevant to that situation.
   */
  public static matches(
    // TODO: Rework to not accept symbols. Just compare both TriggerCreators.
    triggerCreator1: TriggerCreator | symbol,
    triggerCreator2: TriggerCreator | symbol,
  ): boolean {
    const symbol1 = (typeof triggerCreator1 === "symbol" ? triggerCreator1 : triggerCreator1.symbol);
    const symbol2 = (typeof triggerCreator2 === "symbol" ? triggerCreator2 : triggerCreator2.symbol);
    return symbol1 === symbol2;
  }

  private static triggerCreatorHelper(symbolText: string): TriggerCreator {
    const symbol = Symbol(symbolText);
    const triggerCreator: TriggerCreator = function(optionsOrScript, script) {
      return new Trigger(symbol, optionsOrScript, script);
    };

    triggerCreator.symbol = symbol;
    return triggerCreator;
  }

  /**
   * Each property below doubles as a function to create a trigger and a unique
   * object to match trigger instances against that class. For example:
   *
   *   this.triggers = [Trigger.greenFlag(this.whenGreenFlagClicked)];
   *   if (aTrigger.matches(Trigger.greenFlag)) ...;
   *
   * TODO: Remove symbol strings.
   */
  public static readonly greenFlag = this.triggerCreatorHelper("GREEN_FLAG");
  public static readonly keyPressed = this.triggerCreatorHelper("KEY_PRESSED");
  public static readonly broadcastReceived = this.triggerCreatorHelper("BROADCAST");
  public static readonly clicked = this.triggerCreatorHelper("CLICKED");
  public static readonly startedAsClone = this.triggerCreatorHelper("CLONE_START");
  public static readonly loudnessGreaterThan = this.triggerCreatorHelper("LOUDNESS_GREATER_THAN");
  public static readonly timerGreaterThan = this.triggerCreatorHelper("TIMER_GREATER_THAN");
  public static readonly backdropChanged = this.triggerCreatorHelper("BACKDROP_CHANGED");
  public static readonly unreachable = this.triggerCreatorHelper("UNREACHABLE");

  /**
   * @deprecated
   * Prefer accessing the properties above to create or match a trigger.
   */
  public static readonly GREEN_FLAG = this.greenFlag.symbol;
  public static readonly KEY_PRESSED = this.keyPressed.symbol;
  public static readonly BROADCAST = this.broadcastReceived.symbol;
  public static readonly CLICKED = this.clicked.symbol;
  public static readonly CLONE_START = this.startedAsClone.symbol;
  public static readonly LOUDNESS_GREATER_THAN = this.loudnessGreaterThan.symbol;
  public static readonly TIMER_GREATER_THAN = this.timerGreaterThan.symbol;
  public static readonly BACKDROP_CHANGED = this.backdropChanged.symbol;
}

export type { TriggerOption, TriggerOptions };
