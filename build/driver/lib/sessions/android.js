"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getObservatoryWsUri = exports.startAndroidSession = void 0;
const appium_android_driver_1 = require("appium-android-driver");
const child_process_1 = require("child_process");
const util_1 = require("util");
const execPromise = util_1.promisify(child_process_1.exec);
// @ts-ignore
const appium_uiautomator2_driver_1 = __importDefault(require("appium-uiautomator2-driver"));
const logger_1 = require("../logger");
const observatory_1 = require("./observatory");
const setupNewAndroidDriver = async (caps) => {
    const androidArgs = {
        javascriptEnabled: true,
    };
    const androiddriver = new appium_uiautomator2_driver_1.default(androidArgs);
    const capsCopy = Object.assign({}, caps, { newCommandTimeout: 0 });
    await androiddriver.createSession(capsCopy);
    return androiddriver;
};
exports.startAndroidSession = async (caps) => {
    logger_1.log.info(`Starting an Android proxy session`);
    const androiddriver = await setupNewAndroidDriver(caps);
    const observatoryWsUri = exports.getObservatoryWsUri(androiddriver, caps);
    return Promise.all([
        androiddriver,
        observatory_1.connectSocket(await observatoryWsUri, caps.retryBackoffTime, caps.maxRetryCount),
    ]);
};
exports.getObservatoryWsUri = async (proxydriver, caps) => {
    const urlObject = observatory_1.processLogToGetobservatory(proxydriver.adb.logcat.logs);
    const { udid } = await appium_android_driver_1.androidHelpers.getDeviceInfoFromCaps(caps);
    logger_1.log.debug(`${proxydriver.adb.executable.path} -s ${udid} forward tcp:${urlObject.port} tcp:${urlObject.port}`);
    await execPromise(`${proxydriver.adb.executable.path} -s ${udid} forward tcp:${urlObject.port} tcp:${urlObject.port}`);
    return urlObject.toJSON();
};
//# sourceMappingURL=android.js.map