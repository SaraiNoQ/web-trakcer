'use strict';

var TrackerConfig;
(function (TrackerConfig) {
    TrackerConfig["version"] = "1.0.0";
})(TrackerConfig || (TrackerConfig = {}));
const MouseEventList = ['click', 'dblclick', 'contextmenu', 'mousedown', 'mouseup', 'mouseover', 'mouseout', 'mousemove'];

// 发布-订阅模式，重写history中的方法。用户触发history.pushState方法时会注册该事件。
// 然后可以调用方法监听该事件。
const createHistoryEvent = (type) => {
    const origin = history[type];
    return function () {
        const res = origin.apply(this, arguments);
        // 注册事件，使得addEventListener能够监听该事件
        const e = new Event(type);
        window.dispatchEvent(e);
        return res;
    };
};

class Tracker {
    constructor(options) {
        this.data = Object.assign(this.initDef(), options);
        this.installTracker();
    }
    initDef() {
        window.history['pushState'] = createHistoryEvent('pushState');
        window.history['replaceState'] = createHistoryEvent('replaceState');
        // window.history['back'] = createHistoryEvent('back')
        return {
            sdkVersion: TrackerConfig.version,
            historyTracker: false,
            hashTracker: false,
            domTracker: false,
            jsError: false
        };
    }
    setUserId(id) {
        this.data.uuid = id;
    }
    setExtra(extra) {
        this.data.extra = extra;
    }
    /**
     * 手动上报信息
     * @type reportTrackerData 上传数据类型
     */
    sendTracker(data) {
        this.reportTracker(data);
    }
    saveTracker(data) {
        const trackerData = localStorage.getItem('tracker') || undefined;
        if (trackerData) {
            try {
                let arr = JSON.parse(trackerData);
                arr = [...arr, data];
                localStorage.setItem('tracker', JSON.stringify(arr));
            }
            catch (error) {
                console.error('sdk saveTracker error!', error);
            }
        }
        else {
            localStorage.setItem('tracker', JSON.stringify([data]));
        }
    }
    /**
     * 上报信息到后台
     */
    reportTracker(data) {
        const params = Object.assign(this.data, data, { time: new Date().getTime() });
        let headers = {
            type: 'application/x-www-form-urlencoded'
        };
        let blob = new Blob([JSON.stringify(params)], headers);
        navigator.sendBeacon(this.data.requestUrl, blob);
    }
    /**
     * 上报DOM点击事件
     */
    reportDomTracker() {
        MouseEventList.forEach(event => {
            window.addEventListener(event, e => {
                const target = e.target;
                const targetKey = target.getAttribute('data-tracker-key');
                if (targetKey) {
                    this.sendTracker({
                        event,
                        targetKey,
                        clickData: {
                            x: e.clientX,
                            y: e.clientY
                        }
                    });
                }
            });
        });
    }
    /**
     * js错误
     */
    jsError() {
        this.jsErrorEvent();
        this.promiseErrorEvent();
    }
    /**
     * 捕获js错误
     */
    jsErrorEvent() {
        window.addEventListener('error', e => {
            this.sendTracker({
                event: 'js-error',
                targetKey: 'js-error',
                data: {
                    message: e.message,
                    filename: e.filename,
                    lineno: e.lineno,
                    colno: e.colno
                }
            });
        });
    }
    /**
     * 捕获Promise错误
     */
    promiseErrorEvent() {
        window.addEventListener('unhandledrejection', e => {
            e.promise.catch(err => {
                this.sendTracker({
                    event: 'promise-error',
                    targetKey: 'promise-error',
                    data: {
                        message: e.reason.message,
                        filename: e.reason.stack.split('\n')[0],
                        err: err
                    }
                });
            });
        });
    }
    /**
     * 监听器函数
     * @param mouseEventList 触发事件
     * @param targetKey 后台枚举值
     * @param data 其他数据
     */
    captureEvents(mouseEventList, targetKey, data) {
        mouseEventList.forEach(event => {
            window.addEventListener(event, () => {
                console.log('监听到事件:', event);
                this.reportTracker({
                    event,
                    targetKey,
                    data
                });
            });
        });
    }
    /**
     * 安装监听器
     */
    installTracker() {
        if (this.data.historyTracker) {
            this.captureEvents(['pushState', 'replaceState', 'popstate'], 'history-pv');
        }
        if (this.data.hashTracker) {
            this.captureEvents(['hashchange'], 'hash-pv');
        }
        if (this.data.domTracker) {
            this.reportDomTracker();
        }
        if (this.data.jsError) {
            this.jsError();
        }
    }
}

module.exports = Tracker;
