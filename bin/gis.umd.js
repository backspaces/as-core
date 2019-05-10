(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.gis = factory());
}(this, (function () { 'use strict';

// A set of useful misc utils which will eventually move to individual files.
// Note we use arrow functions one-liners, more likely to be optimized.
// REMIND: Test optimization, if none, remove arrow one-liners.

const util = {
    // ### Types

    // Fix the javascript typeof operator https://goo.gl/Efdzk5
    typeOf: obj =>
        ({}.toString
            .call(obj)
            .match(/\s(\w+)/)[1]
            .toLowerCase()),
    isType: (obj, string) => util.typeOf(obj) === string,
    isOneOfTypes: (obj, array) => array.includes(util.typeOf(obj)),
    // Is a number an integer (rather than a float w/ non-zero fractional part)
    isString: obj => util.isType(obj, 'string'),
    isObject: obj => util.isType(obj, 'object'),
    isArray: obj => util.isType(obj, 'array'),
    isNumber: obj => util.isType(obj, 'number'),
    isFunction: obj => util.isType(obj, 'function'),

    isInteger: n => Number.isInteger(n), // assume es6, babel otherwise.
    isFloat: n => util.isNumber(n) && n % 1 !== 0, // https://goo.gl/6MS0Tm
    isCanvas: obj =>
        util.isOneOfTypes(obj, ['htmlcanvaselement', 'offscreencanvas']),
    isHtmlElement: obj => /^html.*element$/.test(util.typeOf(obj)),

    isImage: obj => util.isType(obj, 'image'),
    isImageBitmap: obj => util.isType(obj, 'imagebitmap'),

    // Is undefined, null, bool, number, string, symbol
    isPrimitive: obj => obj == null || 'object' != typeof obj,

    isImageable: obj =>
        util.isOneOfTypes(obj, [
            'image',
            'htmlimageelement',
            'htmlcanvaselement',
            'offscreencanvas',
            'imagebitmap',
        ]),

    // isUintArray: (obj) => util.typeOf(obj).match(/uint.*array/),
    isUintArray: obj => /^uint.*array$/.test(util.typeOf(obj)),
    isIntArray: obj => /^int.*array$/.test(util.typeOf(obj)),
    isFloatArray: obj => /^float.*array$/.test(util.typeOf(obj)),
    // Is obj TypedArray? If obj.buffer not present, works, type is 'undefined'
    isTypedArray: obj => util.typeOf(obj.buffer) === 'arraybuffer',

    // Return array's type (Array or TypedArray variant)
    typeName: obj => obj.constructor.name,

    // Check [big/little endian](https://en.wikipedia.org/wiki/Endianness)
    isLittleEndian() {
        const d32 = new Uint32Array([0x01020304]);
        return new Uint8ClampedArray(d32.buffer)[0] === 4
    },

    // inNode: () =>
    //     typeof window === 'undefined' && typeof global !== 'undefined',
    // inBrowser: () => !util.inNode(),
    // globalObject: () => (util.inNode() ? global : window),

    globalObject() {
        // return window ? window : global ? global : self ? self : undefined
        return window !== undefined
            ? window
            : global !== undefined
                ? global
                : self !== undefined
                    ? self
                    : undefined
    },

    // Identity fcn, returning its argument unchanged. Used in callbacks
    identity: o => o,
    // No-op function, does nothing. Used for default callback.
    noop: () => {},
    // Return function returning an object's property.  Property in fcn closure.
    propFcn: prop => o => o[prop],

    // Convert Array or TypedArray to given Type (Array or TypedArray).
    // Result same length as array, precision may be lost.
    convertArray(array, Type) {
        const Type0 = array.constructor;
        if (Type0 === Type) return array // return array if already same Type
        return Type.from(array) // Use .from (both TypedArrays and Arrays)
    },
    // Convert to/from new Uint8Array view onto an Array or TypedArray.
    // Arrays converted to ArrayType, default Float64Array.
    // Return will in general be a different length than array
    arrayToBuffer(array, ArrayType = Float64Array) {
        if (array.constructor === Array) array = new ArrayType(array);
        return new Uint8Array(array.buffer)
    },
    bufferToArray(uint8array, Type, ArrayType = Float64Array) {
        if (Type === Array) Type = ArrayType;
        return Type === Array
            ? Array.from(new ArrayType(uint8array.buffer))
            : new Type(uint8array.buffer)
        // return new Type(uint8array.buffer)
    },

    // Convert between Uint8Array buffer and base64 string.
    // https://coolaj86.com/articles/typedarray-buffer-to-base64-in-javascript/
    // Stack Overflow: https://goo.gl/xscs8T
    bufferToBase64(uint8Array) {
        const binstr = Array.prototype.map
            .call(uint8Array, ch => String.fromCharCode(ch))
            .join('');
        return btoa(binstr)
    },
    base64ToBuffer(base64) {
        const binstr = atob(base64);
        const uint8Array = new Uint8Array(binstr.length);
        Array.prototype.forEach.call(binstr, (ch, i) => {
            uint8Array[i] = ch.charCodeAt(0);
        });
        return uint8Array
    },

    // ### Debug

    // Two PRNGs.
    randomSeedSin(seed = Math.PI / 4) {
        // ~3.4 million b4 repeat.
        // https://stackoverflow.com/a/19303725/1791917
        return () => {
            const x = Math.sin(seed++) * 10000;
            return x - Math.floor(x)
        }
    },
    randomSeedParkMiller(seed = 123456) {
        // doesn't repeat b4 JS dies.
        // https://gist.github.com/blixt/f17b47c62508be59987b
        seed = seed % 2147483647;
        return () => {
            seed = (seed * 16807) % 2147483647;
            return (seed - 1) / 2147483646
        }
    },
    // Replace Math.random with one of these
    randomSeed(seed, useParkMiller = true) {
        Math.random = useParkMiller
            ? this.randomSeedParkMiller(seed)
            : this.randomSeedSin(seed);
    },

    // Print a message just once.
    logOnce(msg) {
        if (!this.logOnceMsgSet) this.logOnceMsgSet = new Set();
        if (!this.logOnceMsgSet.has(msg)) {
            console.log(msg);
            this.logOnceMsgSet.add(msg);
        }
    },
    warn(msg) {
        this.logOnce('Warning: ' + msg);
    },
    // Print a message to an html element or to console.
    // Default to document.body if in browser.
    // Default to console.log if in node.
    // If msg is an object, convert to JSON
    // print(msg, element = null) {
    //     if (this.isObject(msg)) msg = JSON.stringify(msg)
    //     // if (!element && this.inBrowser()) element = document.body
    //     if (!element && document) element = document.body

    //     if (element) {
    //         element.style.fontFamily = 'monospace'
    //         element.innerHTML += msg + '<br />'
    //     } else {
    //         console.log(msg)
    //     }
    // },

    printToPage(msg, element = document.body) {
        if (util.isObject(msg)) {
            msg = JSON.stringify(msg, null, 2);
            msg = '<pre>' + msg + '</pre>';
        }

        element.style.fontFamily = 'monospace';
        element.innerHTML += msg + '<br />';
    },

    logHistogram(name, array) {
        // const hist = AgentArray.fromArray(dataset.data).histogram()
        const hist = this.histogram(array);
        const { min, max } = hist.parameters;
        console.log(
            `${name}:`, // name + ':'
            hist.toString(),
            'min/max:',
            min.toFixed(3),
            max.toFixed(3)
        );
    },

    // Use chrome/ffox/ie console.time()/timeEnd() performance functions
    timeit(f, runs = 1e5, name = 'test') {
        name = name + '-' + runs;
        console.time(name);
        for (let i = 0; i < runs; i++) f(i);
        console.timeEnd(name);
    },

    fps() {
        const start = performance.now();
        let steps = 0;
        // return function step() {
        //     steps++
        //     const ms = performance.now() - start
        //     const fps = parseFloat((steps / (ms / 1000)).toFixed(2))
        //     Object.assign(step, { fps, ms, start, steps })
        // }
        function perf() {
            steps++;
            const ms = performance.now() - start;
            const fps = parseFloat((steps / (ms / 1000)).toFixed(2));
            Object.assign(perf, { fps, ms, start, steps });
        }
        perf.steps = 0;
        return perf
    },

    // Print Prototype Stack: see your vars all the way down!
    pps(obj, title = '') {
        if (title) console.log(title); // eslint-disable-line
        let count = 1;
        let str = '';
        while (obj) {
            if (typeof obj === 'function') {
                str = obj.constructor.toString();
            } else {
                const okeys = Object.keys(obj);
                str =
                    okeys.length > 0
                        ? `[${okeys.join(', ')}]`
                        : `[${obj.constructor.name}]`;
            }
            console.log(`[${count++}]: ${str}`);
            obj = Object.getPrototypeOf(obj);
        }
    },

    // Return a string representation of an array of arrays
    arraysToString: arrays => arrays.map(a => `[${a}]`).join(','),

    // Merge from's key/val pairs into to the global/window namespace
    toWindow(obj, logToo = false) {
        Object.assign(window, obj);
        // Object.assign(this.globalObject(), obj)
        console.log('toWindow:', Object.keys(obj).join(', '));
        if (logToo) {
            Object.keys(obj).forEach(key => console.log('  ', key, obj[key]));
        }
    },
    // toWindow plus also calling console.log for each item.
    toConsole(obj) {
        this.toWindow(obj);
        Object.keys(obj).forEach(key => console.log('  ', key, obj[key]));
    },
    toGlobal(obj) {
        Object.assign(this.globalObject(), obj);
        console.log('toWindow:', Object.keys(obj).join(', '));
    },

    // Use JSON to return pretty, printable string of an object, array, other
    // Remove ""s around keys.
    objectToString(obj) {
        return JSON.stringify(obj, null, '  ')
            .replace(/ {2}"/g, '  ')
            .replace(/": /g, ': ')
    },
    // Like above, but a single line for small objects.
    objectToString1(obj) {
        return JSON.stringify(obj)
            .replace(/{"/g, '{')
            .replace(/,"/g, ',')
            .replace(/":/g, ':')
    },

    // ### HTML, CSS, DOM

    // REST: Parse the query, returning an object of key/val pairs.
    // parseQueryString() {
    //     const results = {}
    //     const query = document.location.search.substring(1)
    //     query.split('&').forEach(s => {
    //         const param = s.split('=')
    //         // If just key, no val, set val to true
    //         results[param[0]] = param.length === 1 ? true : param[1]
    //     })
    //     return results
    // },
    parseQueryString(paramsString = window.location.search.substr(1)) {
        const results = {};
        const searchParams = new URLSearchParams(paramsString);
        for (var pair of searchParams.entries()) {
            let [key, val] = pair;

            if (val.match(/^[0-9.]+$/)) val = Number(val);
            if (['true', 't', ''].includes(val)) val = true;
            if (['false', 'f'].includes(val)) val = false;

            results[key] = val;
        }
        return results
    },

    // Create dynamic `<script>` tag, appending to `<head>`
    //   <script src="./test/src/three0.js" type="module"></script>
    setScript(path, props = {}) {
        const scriptTag = document.createElement('script');
        scriptTag.src = path;
        // this.forEach(props, (val, key) => { scriptTag[key] = val })
        Object.assign(scriptTag, props);
        document.querySelector('head').appendChild(scriptTag);
    },

    // Convert a function into a worker via blob url.
    // Adds generic error handler. Scripts only, not modules.
    fcnToWorker(fcn) {
        const href = document.location.href;
        const root = href.replace(/\/[^\/]+$/, '/');
        const fcnStr = `(${fcn.toString(root)})("${root}")`;
        const objUrl = URL.createObjectURL(
            new Blob([fcnStr], { type: 'text/javascript' })
        );
        const worker = new Worker(objUrl);
        worker.onerror = function(e) {
            console.log('ERROR: Line ', e.lineno, ': ', e.message);
        };
        return worker
    },

    workerScript(script, worker) {
        const srcBlob = new Blob([script], { type: 'text/javascript' });
        const srcURL = URL.createObjectURL(srcBlob);
        worker.postMessage({ cmd: 'script', url: srcURL });
    },

    // Get element (i.e. canvas) relative x,y position from event/mouse position.
    getEventXY(element, evt) {
        // http://goo.gl/356S91
        const rect = element.getBoundingClientRect();
        return [evt.clientX - rect.left, evt.clientY - rect.top]
    },

    // ### Math

    // Return random int/float in [0,max) or [min,max) or [-r/2,r/2)
    randomInt: max => Math.floor(Math.random() * max),
    randomInt2: (min, max) => min + Math.floor(Math.random() * (max - min)),
    randomFloat: max => Math.random() * max,
    randomFloat2: (min, max) => min + Math.random() * (max - min),
    randomCentered: r => util.randomFloat2(-r / 2, r / 2),
    // min: (a, b) => (a < b) ? a : b, // Math.max/min now faster, yay!
    // max: (a, b) => (a < b) ? b : a,

    // Return float Gaussian normal with given mean, std deviation.
    randomNormal(mean = 0.0, sigma = 1.0) {
        // Box-Muller
        const [u1, u2] = [1.0 - Math.random(), Math.random()]; // ui in 0,1
        const norm =
            Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        return norm * sigma + mean
    },

    // Return whether num is [Power of Two](http://goo.gl/tCfg5). Very clever!
    isPowerOf2: num => (num & (num - 1)) === 0, // twgl library
    // Return next greater power of two. There are faster, see:
    // [Stack Overflow](https://goo.gl/zvD78e)
    nextPowerOf2: num => Math.pow(2, Math.ceil(Math.log2(num))),

    // A [modulus](http://mathjs.org/docs/reference/functions/mod.html)
    // function rather than %, the remainder function.
    // [`((v % n) + n) % n`](http://goo.gl/spr24) also works.
    mod: (v, n) => ((v % n) + n) % n, // v - n * Math.floor(v / n),
    // Wrap v around min, max values if v outside min, max
    wrap: (v, min, max) => min + util.mod(v - min, max - min),
    // Clamp a number to be between min/max.
    // Much faster than Math.max(Math.min(v, max), min)
    clamp(v, min, max) {
        if (v < min) return min
        if (v > max) return max
        return v
    },
    // Return true is val in [min, max] enclusive
    between: (val, min, max) => min <= val && val <= max,

    // Return a linear interpolation between lo and hi.
    // Scale is in [0-1], a percentage, and the result is in [lo,hi]
    // If lo>hi, scaling is from hi end of range.
    // [Why the name `lerp`?](http://goo.gl/QrzMc)
    lerp: (lo, hi, scale) =>
        lo <= hi ? lo + (hi - lo) * scale : lo - (lo - hi) * scale,
    // Calculate the lerp scale given lo/hi pair and a number between them.
    lerpScale: (number, lo, hi) => (number - lo) / (hi - lo),

    // ### Geometry

    // Degrees & Radians
    // radians: (degrees) => util.mod(degrees * Math.PI / 180, Math.PI * 2),
    // degrees: (radians) => util.mod(radians * 180 / Math.PI, 360),
    radians: degrees => (degrees * Math.PI) / 180,
    degrees: radians => (radians * 180) / Math.PI,
    // Heading & Angles:
    // * Heading is 0-up (y-axis), clockwise angle measured in degrees.
    // * Angle is euclidean: 0-right (x-axis), counterclockwise in radians
    heading(radians) {
        // angleToHeading?
        const degrees = this.degrees(radians);
        return this.mod(90 - degrees, 360)
    },
    angle(heading) {
        // headingToAngle?
        const degrees = this.mod(360 - heading, 360);
        return this.radians(degrees)
    },
    // Return angle (radians) in (-pi,pi] that added to rad0 = rad1
    // See NetLogo's [subtract-headings](http://goo.gl/CjoHuV) for explanation
    subtractRadians(rad1, rad0) {
        let dr = this.mod(rad1 - rad0, 2 * Math.PI);
        if (dr > Math.PI) dr = dr - 2 * Math.PI;
        return dr
    },
    // Above using headings (degrees) returning degrees in (-180, 180]
    subtractHeadings(deg1, deg0) {
        let dAngle = this.mod(deg1 - deg0, 360);
        if (dAngle > 180) dAngle = dAngle - 360;
        return dAngle
    },
    // Return angle in [-pi,pi] radians from (x,y) to (x1,y1)
    // [See: Math.atan2](http://goo.gl/JS8DF)
    radiansToward: (x, y, x1, y1) => Math.atan2(y1 - y, x1 - x),
    // Above using headings (degrees) returning degrees in [-90, 90]
    headingToward(x, y, x1, y1) {
        return this.heading(this.radiansToward(x, y, x1, y1))
    },

    // Return distance between (x, y), (x1, y1)
    distance: (x, y, x1, y1) => Math.sqrt(util.sqDistance(x, y, x1, y1)),
    // Return squared distance .. i.e. avoid Math.sqrt. Faster comparisons
    sqDistance: (x, y, x1, y1) => (x - x1) * (x - x1) + (y - y1) * (y - y1),
    // Return true if x,y is within cone.
    // Cone: origin x0,y0 in given direction, with coneAngle width in radians.
    // All angles in radians
    inCone(x, y, radius, coneAngle, direction, x0, y0) {
        if (this.sqDistance(x0, y0, x, y) > radius * radius) return false
        const angle12 = this.radiansToward(x0, y0, x, y); // angle from 1 to 2
        return (
            coneAngle / 2 >= Math.abs(this.subtractRadians(direction, angle12))
        )
    },

    // ### Arrays, Objects and Iteration

    // objectPropertyTypes(obj) {
    //     const propNames = Object.keys(obj)
    //     const result = {}
    //     for (const prop of propNames) {
    //         result[prop] = this.typeOf(obj[prop])
    //     }
    //     return result
    // },

    // getNestedObject(object, string) {
    //     const objs = string.split('.')
    //     if (objs.length === 1) return object[string]
    //     return objs.reduce((acc, val) => {
    //         if (acc === undefined) return undefined
    //         return acc[val]
    //     }, object)
    // },
    nestedProperty(obj, path) {
        if (typeof path === 'string') path = path.split('.');
        switch (path.length) {
        case 1:
            return obj[path[0]]
        case 2:
            return obj[path[0]][path[1]]
        case 3:
            return obj[path[0]][path[1]][path[2]]
        case 4:
            return obj[path[0]][path[1]][path[2]][path[3]]
        default:
            return path.reduce((obj, param) => obj[param], obj)
        }
    },

    // Repeat function f(i, a) n times, i in 0, n-1
    // a is optional array, default a new Array.
    // Return a.
    repeat(n, f, a = []) {
        for (let i = 0; i < n; i++) f(i, a);
        return a
    },
    // Repeat function n/step times, incrementing i by step each step.
    step(n, step, f) {
        for (let i = 0; i < n; i += step) f(i);
    },
    // Return range [0, length-1]. Note: 6x faster than Array.from!
    range(length) {
        return this.repeat(length, (i, a) => {
            a[i] = i;
        })
    },
    // range (length) { return this.repeat(length, (i, a) => { a[i] = i }, []) },

    arrayMax: array => array.reduce((a, b) => Math.max(a, b)),
    arrayMin: array => array.reduce((a, b) => Math.min(a, b)),
    arrayExtent: array => [util.arrayMin(array), util.arrayMax(array)],
    arraySum: array => array.reduce((a, b) => a + b, 0),
    arraysEqual(a1, a2) {
        if (a1.length !== a2.length) return false
        for (let i = 0; i < a1.length; i++) {
            if (a1[i] !== a2[i]) return false
        }
        return true
    },
    removeArrayItem(array, item) {
        const ix = array.indexOf(item);
        if (ix !== -1) array.splice(ix, 1);
        else this.warn(`removeArrayItem: ${item} not in array`);
        return array // for chaining
    },

    // Execute fcn for all own member of an obj or array (typed OK).
    // Return input arrayOrObj, transformed by fcn.
    // - Unlike forEach, does not skip undefines.
    // - Like map, forEach, etc, fcn = fcn(item, key/index, obj).
    // - Alternatives are: `for..of`, array map, reduce, filter etc
    forEach(arrayOrObj, fcn) {
        if (arrayOrObj.slice) {
            // typed & std arrays
            for (let i = 0, len = arrayOrObj.length; i < len; i++) {
                fcn(arrayOrObj[i], i, arrayOrObj);
            }
        } else {
            // obj
            Object.keys(arrayOrObj).forEach(k =>
                fcn(arrayOrObj[k], k, arrayOrObj)
            );
        }
        return arrayOrObj
    },
    // forEach(array, fcn) {
    //     // typed & std arrays
    //     for (let i = 0, len = array.length; i < len; i++) {
    //         fcn(array[i], i, array)
    //     }
    // },
    // forEachKey(obj, fcn) {
    //     Object.keys(obj).forEach(k => fcn(obj[k], k, obj))
    // },

    // Return a new shallow of array, either Array or TypedArray
    clone(array) {
        return array.slice(0)
    },

    // Return a new array that is the concatination two arrays.
    // The resulting Type is that of the first array.
    concatArrays(array1, array2) {
        const Type = array1.constructor;
        if (Type === Array) {
            return array1.concat(this.convertArray(array2, Array))
        }
        const array = new Type(array1.length + array2.length);
        // NOTE: typedArray.set() allows any Array or TypedArray arg
        array.set(array1);
        array.set(array2, array1.length);
        return array
    },

    // Compare Objects or Arrays via JSON string. Note: TypedArrays !== Arrays
    objectsEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b),

    // Create a histogram, given an array, a bin size, and a
    // min bin defaulting to min of of the array.
    // Return an object with:
    // - min/maxBin: the first/last bin with data
    // - min/maxVal: the min/max values in the array
    // - bins: the number of bins
    // - hist: the array of bins
    // histogram(array, bin = 1, min = Math.floor(this.arrayMin(array))) {
    //     const hist = []
    //     let [minBin, maxBin] = [Number.MAX_VALUE, Number.MIN_VALUE]
    //     let [minVal, maxVal] = [Number.MAX_VALUE, Number.MIN_VALUE]
    //     for (const a of array) {
    //         const i = Math.floor(a / bin) - min
    //         hist[i] = hist[i] === undefined ? 1 : hist[i] + 1
    //         minBin = Math.min(minBin, i)
    //         maxBin = Math.max(maxBin, i)
    //         minVal = Math.min(minVal, a)
    //         maxVal = Math.max(maxVal, a)
    //     }
    //     for (const i in hist) {
    //         if (hist[i] === undefined) {
    //             hist[i] = 0
    //         }
    //     }
    //     const bins = maxBin - minBin + 1
    //     return { bins, minBin, maxBin, minVal, maxVal, hist }
    // },

    histogram(
        array,
        bins = 10,
        min = this.arrayMin(array),
        max = this.arrayMax(array)
    ) {
        const binSize = (max - min) / bins;
        const hist = new Array(bins);
        hist.fill(0);
        this.forEach(array, val => {
            // const val = key ? a[key] : a
            if (val < min || val > max) {
                util.warn(`histogram bounds error: ${val}: ${min}-${max}`);
            } else {
                let bin = Math.floor((val - min) / binSize);
                if (bin === bins) bin--; // val is max, round down
                hist[bin]++;
            }
        });
        // Object.assign(hist, {bins, min, max, binSize, key})
        hist.parameters = { bins, min, max, binSize, arraySize: array.length };
        return hist
    },

    // Return random one of array items.
    oneOf: array => array[util.randomInt(array.length)],
    otherOneOf(array, item) {
        if (array.length < 2) throw Error('util.otherOneOf: array.length < 2')
        do {
            var other = this.oneOf(array);
        } while (item === other) // note var use
        return other
    },

    // Random key/val of object
    oneKeyOf: obj => util.oneOf(Object.keys(obj)),
    oneValOf: obj => obj[util.oneKeyOf(obj)],

    // You'd think this wasn't necessary, but I always forget. Damn.
    // NOTE: this, like sort, sorts in place. Clone array if needed.
    sortNums(array, ascending = true) {
        return array.sort((a, b) => (ascending ? a - b : b - a))
    },
    // Sort an array of objects w/ fcn(obj) as compareFunction.
    // If fcn is a string, convert to propFcn.
    sortObjs(array, fcn, ascending = true) {
        if (typeof fcn === 'string') fcn = this.propFcn(fcn);
        const comp = (a, b) => fcn(a) - fcn(b);
        return array.sort((a, b) => (ascending ? comp(a, b) : -comp(a, b)))
    },
    // Randomize array in-place. Use clone() first if new array needed
    // The array is returned for chaining; same as input array.
    // See [Durstenfeld / Fisher-Yates-Knuth shuffle](https://goo.gl/mfbdPh)
    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = array[i];
            array[i] = array[j];
            array[j] = temp;
        }
        return array
    },
    // Returns new array (of this type) of unique elements in this *sorted* array.
    // Sort or clone & sort if needed.
    uniq(array, f = this.identity) {
        if (this.isString(f)) f = this.propFcn(f);
        return array.filter((ai, i, a) => i === 0 || f(ai) !== f(a[i - 1]))
    },
    // Simple uniq on sorted or unsorted array.
    uniqUnsorted: array => Array.from(new Set(array)),

    // Return a "ramp" (array of uniformly ascending/descending floats)
    // in [start,stop] with numItems (positive integer > 1).
    // OK for start>stop. Will always include start/stop w/in float accuracy.
    aRamp(start, stop, numItems) {
        // NOTE: start + step*i, where step is (stop-start)/(numItems-1),
        // has float accuracy problems, must recalc step each iteration.
        if (numItems <= 1) throw Error('aRamp: numItems must be > 1')
        const a = [];
        for (let i = 0; i < numItems; i++) {
            a.push(start + (stop - start) * (i / (numItems - 1)));
        }
        return a
    },
    // Integer version of aRamp, start & stop integers, rounding each element.
    // Default numItems yields unit step between start & stop.
    aIntRamp(start, stop, numItems = Math.abs(stop - start) + 1) {
        return this.aRamp(start, stop, numItems).map(a => Math.round(a))
    },

    // Return an array normalized (lerp) between lo/hi values
    normalize(array, lo = 0, hi = 1) {
        const [min, max] = [this.arrayMin(array), this.arrayMax(array)];
        const scale = 1 / (max - min);
        return array.map(n => this.lerp(lo, hi, scale * (n - min)))
    },
    // Return Uint8ClampedArray normalized in 0-255
    normalize8(array) {
        return new Uint8ClampedArray(this.normalize(array, -0.5, 255.5))
    },
    // Return Array normalized to integers in lo-hi
    normalizeInt(array, lo, hi) {
        return this.normalize(array, lo, hi).map(n => Math.round(n))
    },

    // ### OofA/AofO

    isOofA(data) {
        // const isAofO = this.isArray(data) && this.isObject(data[0])
        // return !isAofO
        if (!this.isObject(data)) return false
        // return Object.values(data).every(v => Array.isArray(v))
        return Object.values(data).every(v => util.isTypedArray(v))
    },
    toOofA(aofo, spec) {
        const length = aofo.length;
        const keys = Object.keys(spec);
        const oofa = {};
        keys.forEach(k => {
            oofa[k] = new spec[k](length);
        });
        util.forEach(aofo, (o, i) => {
            keys.forEach(key => (oofa[key][i] = o[key]));
        });

        return oofa
    },
    oofaObject(oofa, i, keys) {
        const obj = {};
        keys.forEach(key => {
            obj[key] = oofa[key][i];
        });
        return obj
    },
    toAofO(oofa, keys = Object.keys(oofa)) {
        const length = oofa[keys[0]].length;
        const aofo = new Array(length);
        this.forEach(aofo, (val, i) => {
            aofo[i] = this.oofaObject(oofa, i, keys);
        });
        return aofo
    },
    oofaBuffers(postData) {
        const buffers = [];
        this.forEach(postData, obj =>
            this.forEach(obj, a => buffers.push(a.buffer))
        );
        return buffers
    },

    // ### Async

    // Return Promise for getting an image.
    // - use: imagePromise('./path/to/img').then(img => imageFcn(img))
    imagePromise(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => reject(Error(`Could not load image ${url}`));
            img.src = url;
        })
    },

    // Convert canvas.toBlob to a promise
    canvasBlobPromise(can, mimeType = 'image/png', quality = 0.95) {
        return new Promise((resolve, reject) => {
            can.toBlob(blob => resolve(blob), mimeType, quality);
        })
    },
    // Return Promise for ajax/xhr data.
    // - type: 'arraybuffer', 'blob', 'document', 'json', 'text'.
    // - method: 'GET', 'POST'
    // - use: xhrPromise('./path/to/data').then(data => dataFcn(data))
    xhrPromise(url, type = 'text', method = 'GET') {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open(method, url); // POST mainly for security and large files
            xhr.responseType = type;
            xhr.onload = () => resolve(xhr.response);
            xhr.onerror = () =>
                reject(Error(`Could not load ${url}: ${xhr.status}`));
            xhr.send();
        })
    },

    // Return promise for pause of ms. Use:
    // timeoutPromise(2000).then(()=>console.log('foo'))
    timeoutPromise(ms = 1000) {
        return new Promise(resolve => {
            setTimeout(resolve, ms);
        })
    },
    // Use above for an animation loop.
    // steps < 0: forever (default), steps === 0 is no-op
    // Returns a promise for when done. If forever, no need to use it.
    async timeoutLoop(fcn, steps = -1, ms = 0) {
        let i = 0;
        while (i++ !== steps) {
            fcn(i - 1);
            await this.timeoutPromise(ms);
        }
    },

    yieldLoop(fcn, steps = -1) {
        let i = 0;
        function* gen() {
            while (i++ !== steps) {
                yield fcn(i - 1);
            }
        }
        const iterator = gen();
        while (!iterator.next().done) {}
    },

    // Similar pair for requestAnimationFrame
    rafPromise() {
        return new Promise(resolve => requestAnimationFrame(resolve))
    },
    async rafLoop(fcn, steps = -1) {
        let i = 0;
        while (i++ !== steps) {
            fcn(i - 1);
            await this.rafPromise();
        }
    },

    // // Imports a script, waits 'till loaded, then resolves. Use:
    // // scriptPromise('../lib/pako.js', 'pako')
    // //   .then((script) => console.log(script))
    // scriptPromise (path, name, f = () => window[name], props = {}) {
    //   if (window[name] == null) this.setScript(path, props)
    //   return this.waitPromise(() => window[name] != null, f)
    // },
    // // Promise: Wait until done(), then resolve with f()'s value, default to noop
    // // Ex: This waits until window.foo is defined, then reports:
    // // waitPromise(()=>window.foo).then(()=>console.log('foo defined'))
    // waitPromise (done, f = this.noop, ms = 10) {
    //   return new Promise((resolve, reject) => {
    //     this.waitOn(done, () => resolve(f()), ms)
    //   })
    // },
    waitPromise(done, ms = 10) {
        return new Promise(resolve => {
            function waitOn() {
                if (done()) return resolve()
                else setTimeout(waitOn, ms);
            }
            waitOn();
        })
    },
    // // Callback: Wait (setTimeout) until done() true, then call f()
    // waitOn (done, f, ms = 10) {
    //   if (done())
    //     f()
    //   else
    //     setTimeout(() => { this.waitOn(done, f, ms) }, ms)
    // },

    // ### Canvas utilities

    // Create a blank 2D canvas of a given width/height
    // width/height defaulted so can be modified later by caller
    createCanvas(width = 0, height = 0, offscreen = true) {
        // Try OffscreenCanvas in workers and main:
        // if (OffscreenCanvas) return new OffscreenCanvas(width, height)
        // Fallback to DOM if in main
        // if (document) return document.createElement('canvas')
        // Error if in worker and no OffscreenCanvas
        // throw Error(
        //     'createCanvas: Browser does not support worker OffscreenCanvas'
        // )
        if (offscreen) return new OffscreenCanvas(width, height)
        const can = document.createElement('canvas');
        can.width = width;
        can.height = height;
        return can
    },
    // As above, but returing the 2D context object.
    // NOTE: ctx.canvas is the canvas for the ctx, and can be use as an image.
    createCtx(width, height, offscreen = true) {
        const can = this.createCanvas(width, height, offscreen);
        return can.getContext('2d')
    },

    // Duplicate a ctx's image. Returns the new ctx (who's canvas is ctx.caanvas)
    // cloneCtx(ctx0, offscreen = true) {
    //     const ctx = this.createCtx(
    //         ctx0.canvas.width,
    //         ctx0.canvas.height,
    //         offscreen
    //     )
    //     ctx.drawImage(ctx0.canvas, 0, 0)
    //     return ctx
    // },
    // Duplicate a ctx's image. Returns the new ctx (who's canvas is ctx.caanvas)
    // resizeCtx(ctx, width, height) {
    //     const copy = this.cloneCtx(ctx)
    //     ctx.canvas.width = width
    //     ctx.canvas.height = height
    //     ctx.drawImage(copy.canvas, 0, 0)
    // },
    cloneCanvas(can, offscreen = true) {
        const ctx = this.createCtx(can.width, can.height, offscreen);
        ctx.drawImage(can, 0, 0);
        return ctx.canvas
    },
    // Resize a ctx/canvas and preserve data.
    resizeCtx(ctx, width, height) {
        const copy = this.cloneCanvas(ctx.canvas);
        ctx.canvas.width = width;
        ctx.canvas.height = height;
        ctx.drawImage(copy, 0, 0);
    },

    // Set the ctx/canvas size if differs from width/height.
    // It does not install a transform and assumes there is not one currently installed.
    // The World object can do that for AgentSets.
    setCanvasSize(can, width, height) {
        if (can.width !== width || can.height != height) {
            can.width = width;
            can.height = height;
        }
    },

    // Install identity transform for this context.
    // Call ctx.restore() to revert to previous transform.
    setIdentity(ctx) {
        ctx.save(); // NOTE: Does not change state, only saves current state.
        ctx.setTransform(1, 0, 0, 1, 0, 0); // or ctx.resetTransform()
    },
    // Set the text font, align and baseline drawing parameters.
    // Ctx can be either a canvas context or a DOM element
    // See [reference](http://goo.gl/AvEAq) for details.
    // * font is a HTML/CSS string like: "9px sans-serif"
    // * align is left right center start end
    // * baseline is top hanging middle alphabetic ideographic bottom
    setTextParams(ctx, font, textAlign = 'center', textBaseline = 'middle') {
        // ctx.font = font; ctx.textAlign = align; ctx.textBaseline = baseline
        Object.assign(ctx, { font, textAlign, textBaseline });
    },

    // Return the (complete) ImageData object for this context object
    ctxImageData(ctx) {
        return ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
    },
    // Fill this context with the given css color string.
    clearCtx(ctx) {
        util.setIdentity(ctx);
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.restore();
    },
    // Fill this context with the given css color string.
    fillCtx(ctx, cssColor) {
        util.setIdentity(ctx);
        ctx.fillStyle = cssColor;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.restore();
    },
    // Fill this context with the given image. Will scale image to fit ctx size.
    fillCtxWithImage(ctx, img) {
        this.setIdentity(ctx); // set/restore identity
        ctx.drawImage(img, 0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.restore();
    },
    // Fill this context with the given image, resizing it to img size if needed.
    setCtxImage(ctx, img) {
        this.setCanvasSize(ctx.canvas, img.width, img.height);
        this.fillCtxWithImage(ctx, img);
        // this.setIdentity(ctx)
        // ctx.drawImage(img, 0, 0, img.width, img.height)
        // ctx.restore()
    },

    // Use webgl texture to convert img to Uint8Array w/o alpha premultiply
    // or color profile modification.
    // Img can be Image, ImageData, Canvas: [See MDN](https://goo.gl/a3oyRA).
    // `flipY` is used to invert image to upright.
    imageToBytesCtx: null,
    imageToBytes(img, flipY = false, imgFormat = 'RGBA') {
        // Create the gl context using the image width and height
        if (!this.imageToBytesCtx) {
            const can = this.createCanvas(0, 0);
            this.imageToBytesCtx = can.getContext('webgl', {
                premultipliedAlpha: false,
            });
        }

        const { width, height } = img;
        const gl = this.imageToBytesCtx;
        Object.assign(gl.canvas, { width, height });
        const fmt = gl[imgFormat];

        // Create and initialize the texture.
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        if (flipY) {
            // Mainly used for pictures rather than data
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        }
        // Insure [no color profile applied](https://goo.gl/BzBVJ9):
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
        // Insure no [alpha premultiply](http://goo.gl/mejNCK).
        // False is the default, but lets make sure!
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

        // gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
        gl.texImage2D(gl.TEXTURE_2D, 0, fmt, fmt, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

        // Create the framebuffer used for the texture
        const framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            texture,
            0
        );

        // See if it all worked. Apparently not async.
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            throw Error(
                `imageToBytes: status not FRAMEBUFFER_COMPLETE: ${status}`
            )
        }

        // If all OK, create the pixels buffer and read data.
        const pixSize = imgFormat === 'RGB' ? 3 : 4;
        const pixels = new Uint8Array(pixSize * width * height);
        // gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
        gl.readPixels(0, 0, width, height, fmt, gl.UNSIGNED_BYTE, pixels);

        // Unbind the framebuffer and return pixels
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return pixels
    },
};

const { PI, atan, atan2, cos, floor, log, pow, sin, sinh, sqrt, tan } = Math;
const radians = degrees => (degrees * PI) / 180;
const degrees = radians => (radians * 180) / PI;

const gis = {
    //
    //  Slippy Tile Helpers
    //     http://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
    //
    lon2x(lon, z) {
        return floor(((lon + 180) / 360) * pow(2, z))
    },
    lat2y(lat, z) {
        const latRads = radians(lat);
        return floor(
            (1 - log(tan(latRads) + 1 / cos(latRads)) / PI) * pow(2, z - 1)
        )
    },
    lonlat2xy(lon, lat, z) {
        return [this.lon2x(lon, z), this.lat2y(lat, z)]
    },

    x2lon(x, z) {
        return (x / pow(2, z)) * 360 - 180
    },
    y2lat(y, z) {
        // const n = PI - (2 * PI * y) / pow(2, z)
        // // return (180 / PI) * atan(0.5 * (exp(n) - exp(-n)))
        // return degrees(atan(0.5 * (exp(n) - exp(-n))))
        const rads = atan(sinh(PI - (2 * PI * y) / pow(2, z)));
        return degrees(rads)
        // var n = PI - (2 * PI * y) / pow(2, z)
        // return (180 / PI) * atan(0.5 * (exp(n) - exp(-n)))
    },
    xy2lonlat(x, y, z) {
        return [this.x2lon(x, z), this.y2lat(y, z)]
    },
    // Return two lon/lat points for bbox of tile
    xy2bbox(x, y, z) {
        // REMIND: error check at 180, 0 etc
        const [lon0, lat0] = this.xy2lonlat(x, y, z);
        // y increases "down" like pixel coords
        const [lon1, lat1] = this.xy2lonlat(x + 1, y + 1, z);
        return [[lon0, lat0], [lon1, lat1]]
    },

    // Create a url for OSM json data.
    // https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL
    // Args are south, west, north, east
    getOsmURL(minLat, minLon, maxLat, maxLon) {
        const url = 'https://overpass-api.de/api/interpreter?data=';
        // [bbox:south,west,north,east]
        const params = `\
[out:json][timeout:180][bbox:${minLat},${minLon},${maxLat},${maxLon}];
way[highway];
(._;>;);
out;`;
        return url + encodeURIComponent(params)
    },

    // https://stackoverflow.com/questions/639695/how-to-convert-latitude-or-longitude-to-meters
    // Explanation: https://en.wikipedia.org/wiki/Haversine_formula
    lonLat2meters(pt1, pt2) {
        const [lon1, lat1] = pt1.map(val => radians(val)); // lon/lat radians
        const [lon2, lat2] = pt2.map(val => radians(val));

        // generally used geo measurement function
        const R = 6378.137; // Radius of earth in KM
        const dLat = lat2 - lat1;
        const dLon = lon2 - lon1;
        const a =
            pow(sin(dLat / 2), 2) +
            cos(lat1) * cos(lat2) * sin(dLon / 2) * sin(dLon / 2);
        const c = 2 * atan2(sqrt(a), sqrt(1 - a));
        const d = R * c;
        return d * 1000 // meters
    },

    // geojson utilities
    clone(obj) {
        return JSON.parse(JSON.stringify(obj))
    },

    featureFilter(json, featurePath, values) {
        if (typeof values === 'string') values = values.split(' ');
        json.features = json.features.filter(feature => {
            const value = util.nestedProperty(feature, featurePath);
            return values.includes(value)
        });
        return json
    },
    geometryFilter(json, values) {
        return this.featureFilter(json, 'geometry.type', values)
    },
    propertiesFilter(json, properties) {
        if (typeof properties === 'string') properties = properties.split(' ');
        json.features.forEach(feature => {
            const obj = {};
            properties.forEach(prop => {
                if (feature.properties[prop] !== undefined) {
                    obj[prop] = feature.properties[prop];
                }
            });
            feature.properties = obj;
        });
        return json
    },
    streetsFilter(json) {
        this.featureFilter(json, 'geometry.type', 'LineString');
        this.featureFilter(
            json,
            'properties.highway',
            'motorway residential primary secondary tertiary'
        );
        this.propertiesFilter(json, 'highway oneway name tiger:name_base');
        return json
    },
    filter(json, geometry, properties) {
        json = this.clone(json);
        this.geometryFilter(json, geometry);
        this.propertiesFilter(json, properties);
        return json
    },

    minify(json, geometry = null, properties = null) {
        json = this.clone(json);
        if (geometry) json = this.geometryFilter(json, geometry);
        if (properties) json = this.propertiesFilter(json, properties);
        const str = JSON.stringify(json); // compact form
        // newline for each feature
        return str.replace(/,{"type":"Feature"/g, '\n,\n{"type":"Feature"')
    },
    areEqual(json0, json1) {
        return JSON.stringify(json0) === JSON.stringify(json1)
    },
};



// aliasFilter(json, name, aliases) {
//     json.features.map(feature => {
//         const props = feature.properties
//         if (!props[name]) {
//             aliases.forEach(alias => {
//                 if (feature.properties[prop] !== undefined) {
//                     obj[prop] = feature.properties[prop]
//                 }
//             })
//         }
//         return feature
//     })
//     return json
//     // return { type: 'FeatureCollection', features: features }
// },

return gis;

})));