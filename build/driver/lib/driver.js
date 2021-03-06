"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlutterDriver = void 0;
const appium_base_driver_1 = require("appium-base-driver");
const desired_caps_1 = require("./desired-caps");
const logger_1 = require("./logger");
const observatory_1 = require("./sessions/observatory");
const session_1 = require("./sessions/session");
const context_1 = require("./commands/context");
const element_1 = require("./commands/element");
const execute_1 = require("./commands/execute");
const gesture_1 = require("./commands/gesture");
const screen_1 = require("./commands/screen");
class FlutterDriver extends appium_base_driver_1.BaseDriver {
    constructor(opts, shouldValidateCaps) {
        super(opts, shouldValidateCaps);
        this.socket = null;
        this.locatorStrategies = [`key`, `css selector`];
        // session
        this.executeElementCommand = observatory_1.executeElementCommand;
        this.execute = execute_1.execute;
        this.executeAsync = execute_1.execute;
        // element
        this.getText = element_1.getText;
        this.setValue = element_1.setValue;
        this.clear = element_1.clear;
        this.getScreenshot = screen_1.getScreenshot;
        // gesture
        this.click = gesture_1.click;
        this.longTap = gesture_1.longTap;
        this.tapEl = gesture_1.tapEl;
        this.tap = gesture_1.tap;
        this.performTouch = gesture_1.performTouch;
        // context
        this.getContexts = context_1.getContexts;
        this.getCurrentContext = context_1.getCurrentContext;
        this.setContext = context_1.setContext;
        this.currentContext = context_1.FLUTTER_CONTEXT_NAME;
        this.driverShouldDoProxyCmd = context_1.driverShouldDoProxyCmd;
        this.desiredCapConstraints = desired_caps_1.desiredCapConstraints;
        this.proxydriver = null;
        this.device = null;
    }
    async createSession(caps) {
        const [sessionId] = await super.createSession(caps);
        return session_1.createSession.bind(this)(caps, sessionId);
    }
    async deleteSession() {
        await Promise.all([
            session_1.deleteSession.bind(this)(),
            super.deleteSession(),
        ]);
    }
    validateLocatorStrategy(strategy) {
        // @todo refactor DRY
        if (this.currentContext === `NATIVE_APP`) {
            return this.proxydriver.validateLocatorStrategy(strategy);
        }
        super.validateLocatorStrategy(strategy, false);
    }
    validateDesiredCaps(caps) {
        // check with the base class, and return if it fails
        const res = super.validateDesiredCaps(caps);
        if (!res) {
            return res;
        }
        // @ts-ignore
        if (caps.deviceName.toLowerCase() === `android`) {
            if (!caps.avd) {
                const msg = `The desired capabilities must include avd`;
                logger_1.log.errorAndThrow(msg);
            }
        }
        // finally, return true since the superclass check passed, as did this
        return true;
    }
    async executeCommand(cmd, ...args) {
        if (cmd === `receiveAsyncResponse`) {
            logger_1.log.debug(`Executing FlutterDriver response '${cmd}'`);
            return await this.receiveAsyncResponse(...args);
        }
        else if (this.socket) {
            if (this.driverShouldDoProxyCmd(cmd)) {
                logger_1.log.debug(`Executing proxied driver command '${cmd}'`);
                // There are 2 CommandTimeout (FlutterDriver and proxy)
                // Only FlutterDriver CommandTimeout is used; Proxy is disabled
                // All proxy commands needs to reset the FlutterDriver CommandTimeout
                // Here we manually reset the FlutterDriver CommandTimeout for commands that goe to proxy.
                this.clearNewCommandTimeout();
                const result = this.proxydriver.executeCommand(cmd, ...args);
                this.startNewCommandTimeout(cmd);
                return result;
            }
            else {
                logger_1.log.debug(`Executing Flutter driver command '${cmd}'`);
                return super.executeCommand(cmd, ...args);
            }
        }
        else {
            logger_1.log.debug(`Command Error '${cmd}'`);
            throw new appium_base_driver_1.errors.NoSuchDriverError(`Driver is not ready, cannot execute ${cmd}.`);
        }
    }
}
exports.FlutterDriver = FlutterDriver;
//# sourceMappingURL=driver.js.map