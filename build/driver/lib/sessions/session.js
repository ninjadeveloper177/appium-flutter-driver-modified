"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSession = exports.createSession = void 0;
const logger_1 = require("../logger");
const android_1 = require("./android");
const ios_1 = require("./ios");
// tslint:disable-next-line:variable-name
exports.createSession = async function (caps, sessionId) {
    try {
        // setup proxies - if platformName is not empty, make it less case sensitive
        if (caps.platformName !== null) {
            const appPlatform = caps.platformName.toLowerCase();
            switch (appPlatform) {
                case `ios`:
                    [this.proxydriver, this.socket] = await ios_1.startIOSSession(caps);
                    break;
                case `android`:
                    [this.proxydriver, this.socket] = await android_1.startAndroidSession(caps);
                    break;
                default:
                    logger_1.log.errorAndThrow(`Unsupported platformName: ${caps.platformName}`);
            }
        }
        return [sessionId, this.opts];
    }
    catch (e) {
        await this.deleteSession();
        throw e;
    }
};
exports.deleteSession = async function () {
    logger_1.log.debug(`Deleting Flutter Driver session`);
    if (this.proxydriver !== null) {
        await this.proxydriver.deleteSession();
        this.proxydriver = null;
    }
};
//# sourceMappingURL=session.js.map