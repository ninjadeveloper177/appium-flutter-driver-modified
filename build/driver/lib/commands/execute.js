"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.execute = void 0;
const scroll_1 = require("./execute/scroll");
const wait_1 = require("./execute/wait");
const flutterCommandRegex = /^[\s]*flutter[\s]*:(.+)/;
exports.execute = async function (rawCommand, args) {
    // flutter
    const matching = rawCommand.match(flutterCommandRegex);
    if (!matching) {
        throw new Error(`Command not support: "${rawCommand}"`);
    }
    const command = matching[1].trim();
    switch (command) {
        case `checkHealth`:
            return checkHealth(this);
        case `clearTimeline`:
            return clearTimeline(this);
        case `forceGC`:
            return forceGC(this);
        case `getRenderTree`:
            return getRenderTree(this);
        case `getBottomLeft`:
            return getOffset(this, args[0], { offsetType: `bottomLeft` });
        case `getBottomRight`:
            return getOffset(this, args[0], { offsetType: `bottomRight` });
        case `getCenter`:
            return getOffset(this, args[0], { offsetType: `center` });
        case `getTopLeft`:
            return getOffset(this, args[0], { offsetType: `topLeft` });
        case `getTopRight`:
            return getOffset(this, args[0], { offsetType: `topRight` });
        case `getRenderObjectDiagnostics`:
            return getRenderObjectDiagnostics(this, args[0], args[1]);
        case `getSemanticsId`:
            return getSemanticsId(this, args[0]);
        case `waitForAbsent`:
            return wait_1.waitForAbsent(this, args[0], args[1]);
        case `waitFor`:
            return wait_1.waitFor(this, args[0], args[1]);
        case `scroll`:
            return scroll_1.scroll(this, args[0], args[1]);
        case `scrollUntilVisible`:
            return scroll_1.scrollUntilVisible(this, args[0], args[1]);
        case `scrollIntoView`:
            return scroll_1.scrollIntoView(this, args[0], args[1]);
        case `enterText`:
            return enterText(this, args[0]);
        case `longTap`:
            return scroll_1.longTap(this, args[0], args[1]);
        case `waitForFirstFrame`:
            return waitForCondition(this, { conditionName: `FirstFrameRasterizedCondition` });
        default:
            throw new Error(`Command not support: "${rawCommand}"`);
    }
};
const checkHealth = async (self) => (await self.executeElementCommand(`get_health`)).status;
const getRenderTree = async (self) => (await self.executeElementCommand(`get_render_tree`)).tree;
const getOffset = async (self, elementBase64, offsetType) => await self.executeElementCommand(`get_offset`, elementBase64, offsetType);
const waitForCondition = async (self, conditionName) => await self.executeElementCommand(`waitForCondition`, ``, conditionName);
const forceGC = async (self) => {
    const response = await self.socket.call(`_collectAllGarbage`, {
        isolateId: self.socket.isolateId,
    });
    if (response.type !== `Success`) {
        throw new Error(`Could not forceGC, reponse was ${response}`);
    }
};
const anyPromise = (promises) => {
    const newpArray = promises.map((p) => p.then((resolvedValue) => Promise.reject(resolvedValue), (rejectedReason) => rejectedReason));
    return Promise.all(newpArray).then((rejectedReasons) => Promise.reject(rejectedReasons), (resolvedValue) => resolvedValue);
};
const clearTimeline = async (self) => {
    // @todo backward compatible, need to cleanup later
    const call1 = self.socket.call(`_clearVMTimeline`);
    const call2 = self.socket.call(`clearVMTimeline`);
    const response = await anyPromise([call1, call2]);
    if (response.type !== `Success`) {
        throw new Error(`Could not forceGC, reponse was ${response}`);
    }
};
const getRenderObjectDiagnostics = async (self, elementBase64, opts) => {
    const { subtreeDepth = 0, includeProperties = true } = opts;
    return await self.executeElementCommand(`get_diagnostics_tree`, elementBase64, {
        diagnosticsType: `renderObject`,
        includeProperties,
        subtreeDepth,
    });
};
const getSemanticsId = async (self, elementBase64) => (await self.executeElementCommand(`get_semantics_id`, elementBase64)).id;
const enterText = async (self, text) => await self.socket.executeSocketCommand({ command: `enter_text`, text });
//# sourceMappingURL=execute.js.map