(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Shaku = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
/**
 * Assets base class.
 * 
 * |-- copyright and license --|
 * @package    Shaku
 * @file       shaku\lib\assets\asset.js
 * @author     Ronen Ness (ronenness@gmail.com | http://ronenness.com)
 * @copyright  (c) 2021 Ronen Ness
 * @license    MIT
 * |-- end copyright and license --|
 * 
 */
'use strict';


/**
 * A loadable asset base class.
 * All asset types inherit from this.
 */
class Asset
{
    /**
     * Create the new asset.
     * @param {String} url Asset URL / identifier.
     */
    constructor(url)
    {
        this._url = url;
    }

    /**
     * Get asset's URL.
     * @returns {String} Asset URL.
     */
    get url()
    {
        return this._url;
    }

    /**
     * Get if this asset is loaded and valid.
     * @returns {Boolean} True if asset is loaded and valid, false otherwise.
     */
    get valid()
    {
        throw new Error("Not Implemented!");
    }

    /**
     * Load the asset from it's URL.
     * @param {*} params Optional additional params.
     * @returns {Promise} Promise to resolve when fully loaded.
     */
    load(params)
    {
        throw new Error("Not Implemented!");
    }

    /**
     * Create the asset from data source.
     * @param {*} source Data to create asset from.
     * @param {*} params Optional additional params.
     * @returns {Promise} Promise to resolve when asset is ready.
     */
    create(source)
    {
        throw new Error("Not Supported for this asset type.");
    }

    /**
     * Destroy the asset, freeing any allocated resources in the process.
     */
    destroy()
    {
        throw new Error("Not Implemented!");
    }
}


// export the asset base class.
module.exports = Asset;
},{}],2:[function(require,module,exports){
/**
 * Implement the assets manager.
 * 
 * |-- copyright and license --|
 * @package    Shaku
 * @file       shaku\lib\assets\assets.js
 * @author     Ronen Ness (ronenness@gmail.com | http://ronenness.com)
 * @copyright  (c) 2021 Ronen Ness
 * @license    MIT
 * |-- end copyright and license --|
 * 
 */
'use strict';
const SoundAsset = require('../assets/sound_asset.js');
const IManager = require('../manager.js');
const BinaryAsset = require('./binary_asset.js');
const JsonAsset = require('./json_asset.js');
const TextureAsset = require('./texture_asset.js');
const FontTextureAsset = require('./font_texture_asset');
const Asset = require('./asset.js');
const _logger = require('../logger.js').getLogger('assets');


/**
 * Assets manager class.
 * Used to create, load and cache game assets, which includes textures, audio files, JSON objects, etc.
 * As a rule of thumb, all methods to load or create assets are async and return a promise.
 * 
 * To access the Assets manager you use `Shaku.assets`. 
 */
class Assets extends IManager
{
    /**
     * Create the manager.
     */
    constructor()
    {
        super();
        this._loaded = null;
        this._waitingAssets = new Set();
		this._failedAssets = new Set();
        this._successfulLoadedAssetsCount = 0;
    }

    /**
     * Get list of assets waiting to be loaded.
     * This list will be reset if you call clearCache().
     * @returns {Array<string>} URLs of assets waiting to be loaded.
     */
    get pendingAssets()
    {
        return Array.from(this._waitingAssets);
    }
	
    /**
     * Get list of assets that failed to load.
     * This list will be reset if you call clearCache().
     * @returns {Array<string>} URLs of assets that had error loading.
     */	
	get failedAssets()
	{
		return Array.from(this._failedAssets);
	}
	
	/**
	 * Return a promise that will be resolved only when all pending assets are loaded.
	 * If an asset fails, will reject.
     * @example
     * await Shaku.assets.waitForAll();
     * console.log("All assets are loaded!");
     * @returns {Promise} Promise to resolve when all assets are loaded, or reject if there are failed assets.
	 */
	waitForAll()
	{
		return new Promise((resolve, reject) => {
            
            _logger.debug("Waiting for all assets..");

            // check if all assets are loaded or if there are errors
			let checkAssets = () => {

                // got errors?
                if (this._failedAssets.size !== 0) {
                    _logger.warn("Dont waiting for assets: had errors.");
                    return reject(this.failedAssets);
                }

                // all done?
				if (this._waitingAssets.size === 0) {
                    _logger.debug("Dont waiting for assets: everything loaded successfully.");
					return resolve();
				}

                // try again in 1 ms
				setTimeout(checkAssets, 1);
			};

			checkAssets();
		});
	}

    /** 
     * @inheritdoc
     * @private
     */
    setup()
    {        
        return new Promise((resolve, reject) => {
            _logger.info("Setup assets manager..");
            this._loaded = {};
            resolve();
        });
    }

    /** 
     * @inheritdoc
     * @private
     */
    startFrame()
    {
    }

    /** 
     * @inheritdoc
     * @private
     */
    endFrame()
    {
    }

    /**
     * Get already-loaded asset from cache.
     * @private
     * @param {String} url Asset URL.
     * @param {type} type If provided will make sure asset is of this type. If asset found but have wrong type, will throw exception.
     * @returns Loaded asset or null if not found.
     */
    _getFromCache(url, type)
    {
        let cached = this._loaded[url] || null;
        if (cached && type) {
            if (!(cached instanceof type)) { 
                throw new Error(`Asset with URL '${url}' is already loaded, but has unexpected type (expecting ${type})!`); 
            }
        }
        return cached;
    }

    /**
     * Load an asset of a given type and add to cache when done.
     * @private
     * @param {String} url Asset URL.
     * @param {type} type Asset type to load.
     * @param {*} params Optional loading params.
     * @returns {Promise<Asset>} promise to resolve with asset instance, when loaded.
     */
    _loadAndCacheAsset(url, type, params)
    {
        return new Promise(async (resolve, reject) => {

            // update waiting assets count
            this._waitingAssets.add(url);

            _logger.debug(`Load asset [${type.name}] from URL '${url}'.`);

            // load asset
            let newAsset = new type(url);
            try {
                await newAsset.load(params);
            }
            catch (e) {
                _logger.warn(`Failed to load asset [${type.name}] from URL '${url}'.`);
                this._failedAssets.add(url);
                return reject(e);
            }
            this._loaded[url] = newAsset;

            // update waiting assets count
            this._waitingAssets.delete(url);

            // make sure valid
            if (!newAsset.valid) {
                _logger.warn(`Failed to load asset [${type.name}] from URL '${url}'.`);
                this._failedAssets.add(url);
                return reject("Loaded asset is not valid!");
            }

            _logger.debug(`Successfully loaded asset [${type.name}] from URL '${url}'.`);

            // resolve
            this._successfulLoadedAssetsCount++;
            resolve(newAsset);
        });
    }

    /**
     * Get asset directly from cache, synchronous and without a Promise.
     * @param {String} url Asset URL or name. 
     * @returns {Asset} Asset or null if not loaded.
     */
    getCached(url)
    {
        return this._loaded[url] || null;
    }

    /**
     * Load a sound asset. If already loaded, will use cache.
     * @example
     * let sound = await Shaku.assets.loadSound("assets/my_sound.ogg");
     * @param {String} url Asset URL.
     * @returns {Promise<Asset>} promise to resolve with asset instance, when loaded.
     */
    loadSound(url)
    {
        return new Promise(async (resolve, reject) => {

            // try to get from cache
            let cached = this._getFromCache(url, SoundAsset);
            if (cached) { return resolve(cached); }

            // load and return asset
            let newAsset = await this._loadAndCacheAsset(url, SoundAsset);
            resolve(newAsset);
        });
    }

    /**
     * Load a texture asset. If already loaded, will use cache.
     * @example
     * let texture = await Shaku.assets.loadTexture("assets/my_texture.png", {generateMipMaps: false});
     * @param {String} url Asset URL.
     * @param {*} params Optional params dictionary. See TextureAsset.load() for more details.
     * @returns {Promise<Asset>} promise to resolve with asset instance, when loaded.
     */
    loadTexture(url, params)
    {
        return new Promise(async (resolve, reject) => {

            // try to get from cache
            let cached = this._getFromCache(url, TextureAsset);
            if (cached) { return resolve(cached); }

            // load and return asset
            let newAsset = await this._loadAndCacheAsset(url, TextureAsset, params);
            resolve(newAsset);
        });
    }

    /**
     * Create a render target texture asset. If already loaded, will use cache.
     * @example
     * let width = 512;
     * let height = 512;
     * let renderTarget = await Shaku.assets.createRenderTarget("optional_render_target_asset_id", width, height);
     * @param {String} name Asset name (matched to URLs when using cache). If null, will not add to cache.
     * @param {Number} width Texture width.
     * @param {Number} height Texture height.
     * @returns {Promise<Asset>} promise to resolve with asset instance, when loaded.
     */
    createRenderTarget(name, width, height)
    {
        return new Promise(async (resolve, reject) => {

            // make sure we have valid size
            if (!width || !height) {
                return reject("Missing or invalid size!");
            }

            // make sure not in cache
            if (name && this._loaded[name]) { return reject(`Asset with URL or name '${name}' already exist!`); }

            // create and return
            let newAsset = new TextureAsset(name || generateRandomAssetName());
            newAsset.createRenderTarget(width, height);
            if (name) { this._loaded[name] = newAsset; }
            resolve(newAsset);
        });
    }
    
    /**
     * Load a font texture asset. If already loaded, will use cache.
     * @example
     * let fontTexture = await Shaku.assets.loadFontTexture('assets/DejaVuSansMono.ttf', {fontName: 'DejaVuSansMono'});
     * @param {String} url Asset URL.
     * @param {*} params Optional params dictionary. See FontTextureAsset.load() for more details.
     * @returns {Promise<Asset>} promise to resolve with asset instance, when loaded.
     */
    loadFontTexture(url, params)
    {
        return new Promise(async (resolve, reject) => {

            // try to get from cache
            let cached = this._getFromCache(url, FontTextureAsset);
            if (cached) { return resolve(cached); }

            // load and return asset
            let newAsset = await this._loadAndCacheAsset(url, FontTextureAsset, params);
            resolve(newAsset);
        });
    }
    
    /**
     * Load a json asset. If already loaded, will use cache.
     * @example
     * let jsonData = await Shaku.assets.loadJson('assets/my_json_data.json');
     * console.log(jsonData.data);
     * @param {String} url Asset URL.
     * @returns {Promise<Asset>} promise to resolve with asset instance, when loaded.
     */
    loadJson(url)
    {
        return new Promise(async (resolve, reject) => {

            // try to get from cache
            let cached = this._getFromCache(url, JsonAsset);
            if (cached) { return resolve(cached); }

            // load and return asset
            let newAsset = await this._loadAndCacheAsset(url, JsonAsset);
            resolve(newAsset);
        });
    }
 
    /**
     * Create a new json asset. If already exist, will reject promise.
     * @example
     * let jsonData = await Shaku.assets.createJson('optional_json_data_id', {"foo": "bar"});
     * // you can now load this asset from anywhere in your code using 'optional_json_data_id' as url
     * @param {String} name Asset name (matched to URLs when using cache). If null, will not add to cache.
     * @param {Object|String} data Optional starting data.
     * @returns {Promise<Asset>} promise to resolve with asset instance, when ready.
     */
    createJson(name, data)
    {
        return new Promise(async (resolve, reject) => {

            // make sure not in cache
            if (name && this._loaded[name]) { return reject(`Asset with URL or name '${name}' already exist!`); }

            // create and return the new json asset
            let newAsset = new JsonAsset(name || generateRandomAssetName());
            await newAsset.create(data);
            if (name) { this._loaded[name] = newAsset; }
            resolve(newAsset);
        });
    }

    /**
     * Load a binary data asset. If already loaded, will use cache.
     * @example
     * let binData = await Shaku.assets.loadBinary('assets/my_bin_data.dat');
     * console.log(binData.data);
     * @param {String} url Asset URL.
     * @returns {Promise<Asset>} promise to resolve with asset instance, when loaded.
     */
    loadBinary(url)
    {
        return new Promise(async (resolve, reject) => {

            // try to get from cache
            let cached = this._getFromCache(url, BinaryAsset);
            if (cached) { return resolve(cached); }

            // load and return asset
            let newAsset = await this._loadAndCacheAsset(url, BinaryAsset);
            resolve(newAsset);
        });
    }

    /**
     * Create a new binary asset. If already exist, will reject promise.
     * @example
     * let binData = await Shaku.assets.createBinary('optional_bin_data_id', [1,2,3,4]);
     * // you can now load this asset from anywhere in your code using 'optional_bin_data_id' as url
     * @param {String} name Asset name (matched to URLs when using cache). If null, will not add to cache.
     * @param {Array<Number>|Uint8Array} data Binary data to set.
     * @returns {Promise<Asset>} promise to resolve with asset instance, when ready.
     */
    createBinary(name, data)
    {
        return new Promise(async (resolve, reject) => {

            // make sure not in cache
            if (name && this._loaded[name]) { return reject(`Asset with URL or name '${name}' already exist!`); }

            // create and return the new binary asset
            let newAsset = new BinaryAsset(name || generateRandomAssetName());
            await newAsset.create(data);
            if (name) { this._loaded[name] = newAsset; }
            resolve(newAsset);
        });
    }

    /**
     * Destroy and free asset from cache.
     * @example
     * Shaku.assets.free("my_asset_url");
     * @param {String} url Asset URL to free.
     */
    free(url)
    {
        let asset = this._loaded[url];
        if (asset) {
            asset.destroy();
            delete this._loaded[url];
        }
    }
	
	/**
	 * Free all loaded assets from cache.
     * @example
     * Shaku.assets.clearCache();
	 */
	clearCache()
	{
		for (let key in this._loaded) {
            this._loaded[key].destroy();
        }
        this._loaded = {};
        this._waitingAssets = new Set();
		this._failedAssets = new Set();
	}

    /** 
     * @inheritdoc
     * @private
     */
    destroy()
    {
		this.clearCache();
    }
}

// generate a random asset URL, for when creating assets that are outside of cache.
var _nextRandomAssetId = 0;
function generateRandomAssetName()
{
    return "_runtime_asset_" + (_nextRandomAssetId++) + "_";
}
 
// export assets manager
module.exports = new Assets();
},{"../assets/sound_asset.js":7,"../logger.js":28,"../manager.js":29,"./asset.js":1,"./binary_asset.js":3,"./font_texture_asset":4,"./json_asset.js":6,"./texture_asset.js":8}],3:[function(require,module,exports){
/**
 * Implement binary data asset type.
 * 
 * |-- copyright and license --|
 * @package    Shaku
 * @file       shaku\lib\assets\binary_asset.js
 * @author     Ronen Ness (ronenness@gmail.com | http://ronenness.com)
 * @copyright  (c) 2021 Ronen Ness
 * @license    MIT
 * |-- end copyright and license --|
 * 
 */
'use strict';
const Asset = require("./asset");


/**
 * A loadable binary data asset.
 * This asset type loads array of bytes from a remote file.
 */
class BinaryAsset extends Asset
{
    /** @inheritdoc */
    constructor(url)
    {
        super(url);
        this._data = null;
    }

    /**
     * Load the binary data from the asset URL.
     * @returns {Promise} Promise to resolve when fully loaded.
     */
    load()
    {
        return new Promise((resolve, reject) => {

            var request = new XMLHttpRequest();
            request.open('GET', this.url, true);
            request.responseType = 'arraybuffer';     

            // on load, validate audio content
            request.onload = () => 
            {
                if (request.readyState == 4) {
                    if (request.response) {
                        this._data = new Uint8Array(request.response);
                        resolve();
                    }
                    else {
                        reject("Response is not a valid binary data!");
                    }
                }
            }

            // on load error, reject
            request.onerror = (e) => {
                reject(e);
            }

            // initiate request
            request.send();
        });
    }

    /**
     * Create the binary data asset from array or Uint8Array.
     * @param {Array<Number>|Uint8Array} source Data to create asset from.
     * @returns {Promise} Promise to resolve when asset is ready.
     */
    create(source)
    {
        return new Promise((resolve, reject) => {
            if (source instanceof Array) { source = new Uint8Array(source); }
            if (!(source instanceof Uint8Array)) { return reject("Binary asset source must be of type 'Uint8Array'!"); }
            this._data = source;
            resolve();
        });
    }

    /** @inheritdoc */
    get valid()
    {
        return Boolean(this._data);
    }

    /** @inheritdoc */
    destroy()
    {
        this._data = null;
    }

    /**
     * Get binary data.
     * @returns {Uint8Array} Data as bytes array.
     */
    get data()
    {
        return this._data;
    }

    /**
     * Convert and return data as string.
     * @returns {String} Data converted to string.
     */
    string()
    {
        return (new TextDecoder()).decode(this._data);
    }
}


// export the asset type.
module.exports = BinaryAsset;
},{"./asset":1}],4:[function(require,module,exports){
/**
 * Implement a font texture asset type.
 * 
 * |-- copyright and license --|
 * @package    Shaku
 * @file       shaku\lib\assets\font_texture_asset.js
 * @author     Ronen Ness (ronenness@gmail.com | http://ronenness.com)
 * @copyright  (c) 2021 Ronen Ness
 * @license    MIT
 * |-- end copyright and license --|
 * 
 */
'use strict';
const Asset = require("./asset");
const Vector2 = require("../utils/vector2");
const Rectangle = require("../utils/rectangle");
const TextureAsset = require("./texture_asset");


/**
 * A font texture asset, dynamically generated from loaded font and canvas.
 * This asset type creates an atlas of all the font's characters as textures, so we can later render them as sprites.
 */
class FontTextureAsset extends Asset
{
    /** @inheritdoc */
    constructor(url)
    {
        super(url);
        this._fontName = null;
        this._fontSize = null;
        this._placeholderChar = null;
        this._sourceRects = null;
        this._texture = null;
        this._lineHeight = 0;
    }

    /**
     * Get line height.
     */
    get lineHeight()
    {
        return this._lineHeight;
    }

    /**
     * Get font name.
     */
    get fontName()
    {
        return this._fontName;
    }

    /**
     * Get font size.
     */
    get fontSize()
    {
        return this._fontSize;
    }

    /**
     * Get placeholder character.
     */
    get placeholderCharacter()
    {
        return this._placeholderChar;
    }

    /**
     * Get the texture.
     */
    get texture()
    {
        return this._texture;
    }

    /**
     * Generate the font texture from a font found in given URL.
     * @param {*} params Additional params. Possible values are:
     *                      - fontName: mandatory font name. on some browsers if the font name does not match the font you actually load via the URL, it will not be loaded properly.
     *                      - missingCharPlaceholder (default='?'): character to use for missing characters.
     *                      - smoothFont (default=true): if true, will set font to smooth mode.
     *                      - fontSize (default=52): font size in texture. larget font size will take more memory, but allow for sharper text rendering in larger scales.
     *                      - enforceTexturePowerOfTwo (default=true): if true, will force texture size to be power of two.
     *                      - maxTextureWidth (default=1024): max texture width.
     *                      - charactersSet (default=FontTextureAsset.defaultCharactersSet): which characters to set in the texture.
     * @returns {Promise} Promise to resolve when fully loaded.
     */
    load(params)
    {
        return new Promise(async (resolve, reject) => {
            
            if (!params || !params.fontName) {
                return reject("When loading font texture you must provide params with a 'fontName' value!");
            }
        
            // set default missing char placeholder + store it
            this._placeholderChar = (params.missingCharPlaceholder || '?')[0];
    
            // set smoothing mode
            let smooth = params.smoothFont === undefined ? true : params.smoothFont;
    
            // set max texture size
            let maxTextureWidth = params.maxTextureWidth || 1024;
    
            // default chars set
            let charsSet = params.charactersSet || FontTextureAsset.defaultCharactersSet;
    
            // make sure charSet got the placeholder char
            if (charsSet.indexOf(this._placeholderChar) === -1) {
                charsSet += this._placeholderChar;
            }
    
            // load font
            let fontFace = new FontFace(params.fontName, `url(${this.url})`);
            await fontFace.load();
            document.fonts.add(fontFace);
            
            // store font name and size
            this._fontName = params.fontName;
            this._fontSize = params.fontSize || 52;
            let margin = {x: 10, y: 5};

            // measure font height
            let fontFullName = this.fontSize.toString() + 'px ' + this.fontName;
            let fontHeight = measureTextHeight(this.fontName, this.fontSize);
            let fontWidth = measureTextWidth(this.fontName, this.fontSize);

            // set line height
            this._lineHeight = fontHeight;

            // calc estimated size of a single character in texture
            let estimatedCharSizeInTexture = new Vector2(fontWidth + margin.x * 2, fontHeight + margin.y * 2);

            // calc texture size
            let charsPerRow = Math.floor(maxTextureWidth / estimatedCharSizeInTexture.x);
            let textureWidth = Math.min(charsSet.length * estimatedCharSizeInTexture.x, maxTextureWidth);
            let textureHeight = Math.ceil(charsSet.length / charsPerRow) * (estimatedCharSizeInTexture.y);

            // make width and height powers of two
            if (params.enforceTexturePowerOfTwo || params.enforceTexturePowerOfTwo === undefined) {
                textureWidth = makePowerTwo(textureWidth);
                textureHeight = makePowerTwo(textureHeight);
            }

            // a dictionary to store the source rect of every character
            this._sourceRects = {};

            // create a canvas to generate the texture on
            let canvas = document.createElement('canvas');
            canvas.width = textureWidth;
            canvas.height = textureHeight;
            if (!smooth) {
                canvas.style.webkitFontSmoothing = "none";
                canvas.style.fontSmooth = "never";
                canvas.style.textRendering = "geometricPrecision";
            }
            let ctx = canvas.getContext('2d');

            // set font and white color
            ctx.font = fontFullName;
            ctx.fillStyle = '#ffffffff';
            ctx.imageSmoothingEnabled = smooth;

            // draw the font texture
            let x = 0; let y = 0;
            for (let i = 0; i < charsSet.length; ++i) {
                
                // get actual width of current character
                let currChar = charsSet[i];
                let currCharWidth = Math.ceil(ctx.measureText(currChar).width);

                // check if need to break line down in texture
                if (x + currCharWidth > textureWidth) {
                    y += Math.round(fontHeight + margin.y);
                    x = 0;
                }

                // calc source rect
                let sourceRect = new Rectangle(x, y + Math.round(fontHeight / 4), currCharWidth, fontHeight);
                this._sourceRects[currChar] = sourceRect;

                // draw character
                ctx.fillText(currChar, x, y + fontHeight);

                // move to next spot in texture
                x += Math.round(currCharWidth + margin.x);
            }
                    
            // do threshold effect
            if (!smooth) {
                let imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
                let data = imageData.data;
                for (let i = 0; i < data.length; i += 4) {
                    if (data[i+3] > 0 && (data[i+3] < 255 || data[i] < 255 || data[i+1] < 255 || data[i+2] < 255)) {
                        data[i + 3] = 0;
                    }
                }
                ctx.putImageData(imageData, 0, 0);
            }

            // convert canvas to image
            let img = new Image();
            img.src = canvas.toDataURL("image/png");
            img.onload = () => {

                // convert image to texture
                let texture = new TextureAsset(this.url + '__font-texture');
                texture.fromImage(img);

                // success!
                this._texture = texture;
                resolve();

            };
        });
    }

    /** @inheritdoc */
    get valid()
    {
        return Boolean(this._texture);
    }
    
    /**
     * Get the source rectangle for a given character in texture.
     * @param {Character} character Character to get source rect for.
     * @returns {Rectangle} Source rectangle for character.
     */
    getSourceRect(character)
    {
        return this._sourceRects[character] || this._sourceRects[this.placeholderCharacter];
    }

    /** @inheritdoc */
    destroy()
    {
        if (this._texture) this._texture.destroy();
        this._fontName = null;
        this._fontSize = null;
        this._placeholderChar = null;
        this._sourceRects = null;
        this._texture = null;
        this._lineHeight = 0;
    }
}

// default ascii characters to generate font textures for
FontTextureAsset.defaultCharactersSet = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\]^_`abcdefghijklmnopqrstuvwxyz{|}~ ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾";

// return the closest power-of-two value to a given number
function makePowerTwo(val)
{
    let ret = 2;
    while (ret < val) {
        if (ret >= val) { return ret; }
        ret = ret * 2;
    }
    return ret;
}


/**
 * Measure font's actual height.
 */
function measureTextHeight(fontFamily, fontSize, char) 
{
    let text = document.createElement('pre');
    text.style.fontFamily = fontFamily;
    text.style.fontSize = fontSize + "px";
    text.style.paddingBottom = text.style.paddingLeft = text.style.paddingTop = text.style.paddingRight = '0px';
    text.style.marginBottom = text.style.marginLeft = text.style.marginTop = text.style.marginRight = '0px';
    text.textContent = char || "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ";
    document.body.appendChild(text);
    let result = text.getBoundingClientRect().height;
    document.body.removeChild(text);
    return Math.ceil(result);
};

/**
 * Measure font's actual width.
 */
function measureTextWidth(fontFamily, fontSize, char) 
{
    // special case to ignore \r and \n when measuring text width
    if (char === '\n' || char === '\r') { return 0; }

    // measure character width
    let canvas = document.createElement("canvas");
    let context = canvas.getContext("2d");
    context.font = fontSize.toString() + 'px ' + fontFamily;
    let result = 0;
    let text = char || "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ";
    for (let i = 0; i < text.length; ++i) {
        result = Math.max(result, context.measureText(text[i]).width);
    }
    return Math.ceil(result);
};

// export the asset type.
module.exports = FontTextureAsset;
},{"../utils/rectangle":40,"../utils/vector2":41,"./asset":1,"./texture_asset":8}],5:[function(require,module,exports){
/**
 * Just an alias to main manager so we can require() this folder as a package.
 * 
 * |-- copyright and license --|
 * @package    Shaku
 * @file       shaku\lib\assets\index.js
 * @author     Ronen Ness (ronenness@gmail.com | http://ronenness.com)
 * @copyright  (c) 2021 Ronen Ness
 * @license    MIT
 * |-- end copyright and license --|
 * 
 */
 'use strict';
 module.exports = require('./assets');
},{"./assets":2}],6:[function(require,module,exports){
/**
 * Implement json asset type.
 * 
 * |-- copyright and license --|
 * @package    Shaku
 * @file       shaku\lib\assets\json_asset.js
 * @author     Ronen Ness (ronenness@gmail.com | http://ronenness.com)
 * @copyright  (c) 2021 Ronen Ness
 * @license    MIT
 * |-- end copyright and license --|
 * 
 */
'use strict';
const Asset = require("./asset");


/**
 * A loadable json asset.
 * This asset type loads JSON from a remote file.
 */
class JsonAsset extends Asset
{
    /** @inheritdoc */
    constructor(url)
    {
        super(url);
        this._data = null;
    }

    /**
     * Load the JSON data from the asset URL.
     * @returns {Promise} Promise to resolve when fully loaded.
     */
    load()
    {
        return new Promise((resolve, reject) => {

            var request = new XMLHttpRequest();
            request.open('GET', this.url, true);
            request.responseType = 'json';     

            // on load, validate audio content
            request.onload = () => 
            {
                if (request.readyState == 4) {
                    if (request.response) {
                        this._data = request.response;
                        resolve();
                    }
                    else {
                        reject("Response is not a valid JSON!");
                    }
                }
            }

            // on load error, reject
            request.onerror = (e) => {
                reject(e);
            }

            // initiate request
            request.send();
        });
    }

    /**
     * Create the JSON data asset from object or string.
     * @param {Object|String} source Data to create asset from.
     * @returns {Promise} Promise to resolve when asset is ready.
     */
    create(source)
    {
        return new Promise((resolve, reject) => {

            // make sure data is a valid json + clone it
            try
            {
                if (source) {
                    if (typeof source === 'string') {
                        source = JSON.parse(source);
                    }
                    else {
                        source = JSON.parse(JSON.stringify(source));
                    }
                }
                else {
                    source = {};
                }
            }
            catch (e)
            {
                return reject("Data is not a valid JSON serializable object!");
            }

            // store data and resolve
            this._data = source;
            resolve();
        });
    }

    /**
     * Get json data.
     * @returns {*} Data as dictionary.
     */
    get data()
    {
        return this._data;
    }

    /** @inheritdoc */
    get valid()
    {
        return Boolean(this._data);
    }
    
    /** @inheritdoc */
    destroy()
    {
        this._data = null;
    }
}


// export the asset type.
module.exports = JsonAsset;
},{"./asset":1}],7:[function(require,module,exports){
/**
 * Implement sound asset type.
 * 
 * |-- copyright and license --|
 * @package    Shaku
 * @file       shaku\lib\assets\sound_asset.js
 * @author     Ronen Ness (ronenness@gmail.com | http://ronenness.com)
 * @copyright  (c) 2021 Ronen Ness
 * @license    MIT
 * |-- end copyright and license --|
 * 
 */
'use strict';
const Asset = require("./asset");

 
/**
 * A loadable sound asset.
 * This is the asset type you use to play sounds.
 */
class SoundAsset extends Asset
{
    /** @inheritdoc */
    constructor(url)
    {
        super(url);
        this._valid = false;
    }


    /**
     * Load the sound asset from its URL.
     * Note that loading sounds isn't actually necessary to play sounds, this method merely pre-load the asset (so first time we play
     * the sound would be immediate and not delayed) and validate the data is valid. 
     * @returns {Promise} Promise to resolve when fully loaded.
     */
    load()
    {
        // for audio files we force preload and validation of the audio file.
        // note: we can't use the Audio object as it won't work without page interaction.
        return new Promise((resolve, reject) => {

            // create request to load audio file
            let audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            var request = new XMLHttpRequest();
            request.open('GET', this.url, true);
            request.responseType = 'arraybuffer';     

            // on load, validate audio content
            request.onload = () => 
            {
                var audioData = request.response;
                this._valid = true; // <-- good enough for now, as decodeAudio won't work before user's input
                audioCtx.decodeAudioData(audioData, function(buffer) {
                    resolve();
                },
                (e) => { 
                    reject(e.err); 
                });
            }

            // on load error, reject
            request.onerror = (e) => {
                reject(e);
            }

            // initiate request
            request.send();
        });
    }

    /** @inheritdoc */
    get valid()
    {
        return this._valid;
    }
    
    /** @inheritdoc */
    destroy()
    {
        this._valid = false;
    }
}

 
// export the asset type.
module.exports = SoundAsset;
},{"./asset":1}],8:[function(require,module,exports){
/**
 * Implement texture asset type.
 * 
 * |-- copyright and license --|
 * @package    Shaku
 * @file       shaku\lib\assets\texture_asset.js
 * @author     Ronen Ness (ronenness@gmail.com | http://ronenness.com)
 * @copyright  (c) 2021 Ronen Ness
 * @license    MIT
 * |-- end copyright and license --|
 * 
 */
'use strict';
const Asset = require("./asset");
const TextureFilterModes = require('../gfx/texture_filter_modes');
const TextureWrapModes = require('../gfx/texture_wrap_modes');
const Color = require('../utils/color');
const Vector2 = require("../utils/vector2");
const _logger = require('../logger.js').getLogger('assets');

// the webgl context to use
var gl = null;


/**
 * A loadable texture asset.
 * This asset type loads an image from URL or source, and turn it into a texture.
 */
class TextureAsset extends Asset
{
    /** @inheritdoc */
    constructor(url)
    {
        super(url);
        this._image = null;
        this._width = 0;
        this._height = 0;
        this._texture = null;
        this._filter = null;
        this._wrapMode = null;
        this._ctxForPixelData = null;
    }

    /**
     * Set the WebGL context.
     * @private
     */
    static _setWebGl(_gl)
    {
        gl = _gl;
    }

    /**
     * Get texture magnifying filter, or null to use default.
     * @see Shaku.gfx.TextureFilterModes
     */
    get filter()
    {
        return this._filter;
    }

    /**
     * Set texture magnifying filter.
     * @see Shaku.gfx.TextureFilterModes 
     * @param {TextureFilterModes} value Filter mode to use or null to use default.
     */
    set filter(value)
    {
        this._filter = value;
    }

    /**
     * Get texture wrapping mode, or null to use default.
     * @see Shaku.gfx.TextureWrapModes
     */
    get wrapMode()
    {
        return this._wrapMode;
    }

    /**
     * Set texture wrapping mode.
     * @see Shaku.gfx.TextureWrapModes
     * @param {TextureWrapModes} value Wrapping mode to use or null to use default.
     */
    set wrapMode(value)
    {
        this._wrapMode = value;
    }
    
    /**
     * Load the texture from it's image URL.
     * @param {*} params Optional additional params. Possible values are:
     *                      - generateMipMaps (default=false): should we generate mipmaps for this texture?
     * @returns {Promise} Promise to resolve when fully loaded.
     */
    load(params)
    {
        // default params
        params = params || {};

        return new Promise((resolve, reject) => {

            if (!gl) {
                return reject("Can't load textures before initializing gfx manager!");
            }

            // create image to load
            const image = new Image();    
            image.onload = async () =>
            {
                try {
                    await this.create(image, params);
                    resolve();
                }
                catch (e) {
                    reject(e);
                }
            };
            image.onerror = () => {
                reject("Failed to load texture image!");
            }

            // initiate image load
            image.src = this.url;
        });
    }

    /**
     * Create this texture as an empty render target.
     * @param {Number} width Texture width.
     * @param {Number} height Texture height.
     */
    createRenderTarget(width, height)
    {
        // create to render to
        const targetTextureWidth = width;
        const targetTextureHeight = height;
        const targetTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, targetTexture);
        
        {
            // create texture
            const level = 0;
            const internalFormat = gl.RGBA;
            const border = 0;
            const format = gl.RGBA;
            const type = gl.UNSIGNED_BYTE;
            const data = null;
            gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                            targetTextureWidth, targetTextureHeight, border,
                            format, type, data);
            
            // set default wrap and filter modes
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        }

        // store texture
        this._width = width;
        this._height = height;
        this._texture = targetTexture;
    }

    /**
     * Create texture from loaded image instance.
     * @see TextureAsset.load for params.
     * @param {Image} image Image to create texture from. Image must be loaded!
     * @param {*} params Optional additional params. See load() for details.
     */
    fromImage(image, params)
    {
        if (image.width === 0) { 
            throw new Error("Image to build texture from must be loaded and have valid size!");
        }

        if (this.valid) {
            throw new Error("Texture asset is already initialized!");
        }
        
        // default params
        params = params || {};

        // store image
        this._image = image;
        this._width = image.width;
        this._height = image.height;

        // create texture
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);

        // set texture
        const level = 0;
        const internalFormat = gl.RGBA;
        const srcFormat = gl.RGBA;
        const srcType = gl.UNSIGNED_BYTE;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, srcFormat, srcType, image);

        // WebGL1 has different requirements for power of 2 images
        // vs non power of 2 images so check if the image is a
        // power of 2 in both dimensions.
        if (params.generateMipMaps) {
            if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
                _logger.warn("Tried to generate MipMaps for a texture with size that is *not* a power of two. This might not work as expected.");
            } 
            gl.generateMipmap(gl.TEXTURE_2D);
        }

        // default wrap and filters
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

        // success!
        this._texture = texture;
    }

    /**
     * Create the texture from an image.
     * @see TextureAsset.load for params.
     * @param {Image|String} source Image or Image source URL to create texture from.
     * @param {*} params Optional additional params. See load() for details.
     * @returns {Promise} Promise to resolve when asset is ready.
     */
    create(source, params)
    {
        return new Promise(async (resolve, reject) => {

            if (typeof source === "string") {
                let img = new Image();
                img.onload = () => {
                    this.fromImage(source, params);
                    resolve();
                }
                img.src = source;
            }
            else {
                this.fromImage(source, params);
                resolve();
            }
        });
    }

    /**
     * Get raw image.
     * @returns {Image} Image instance.
     */
    get image()
    {
        return this._image;
    }

    /**
     * Get texture width.
     * @returns {Number} Texture width.
     */
    get width()
    {
        return this._width;
    }

    /**
     * Get texture height.
     * @returns {Number} Texture height.
     */
    get height()
    {
        return this._height;
    }

    /**
     * Get texture size as a vector.
     * @returns {Vector2} Texture size.
     */
    get size()
    {
        return new Vector2(this.width, this.height);
    }

    /**
     * Get texture instance for WebGL.
     */
    get texture()
    {
        return this._texture;
    }

    /**
     * Get pixel color from image.
     * @param {Number} x Pixel X value.
     * @param {Number} y Pixel Y value.
     * @returns {Color} Pixel color.
     */
    getPixel(x, y) 
    {
        if (!this._image) { 
            throw new Error("'getPixel()' only works on textures loaded from image!");
        }

        // build internal canvas and context to get pixel data
        if (!this._ctxForPixelData) {
            let canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;
            this._ctxForPixelData = canvas.getContext('2d');
        }

        // get pixel data
        let ctx = this._ctxForPixelData;
        ctx.drawImage(this._image, x, y, 1, 1, 0, 0, 1, 1);
        let pixelData = ctx.getImageData(0, 0, 1, 1).data;   
        return Color.fromBytesArray(pixelData);
    }

    /** @inheritdoc */
    get valid()
    {
        return Boolean(this._texture);
    }

    /** @inheritdoc */
    destroy()
    {
        gl.deleteTexture(this._texture);
        this._image = null;
        this._width = this._height = 0;
        this._ctxForPixelData = null;
        this._texture = null;
    }
}

// check if value is a power of 2
function isPowerOf2(value) {
    return (value & (value - 1)) == 0;
}


// export the asset type.
module.exports = TextureAsset;
},{"../gfx/texture_filter_modes":22,"../gfx/texture_wrap_modes":23,"../logger.js":28,"../utils/color":37,"../utils/vector2":41,"./asset":1}],9:[function(require,module,exports){
/**
 * Define supported blend modes.
 * 
 * |-- copyright and license --|
 * @package    Shaku
 * @file       shaku\lib\gfx\blend_modes.js
 * @author     Ronen Ness (ronenness@gmail.com | http://ronenness.com)
 * @copyright  (c) 2021 Ronen Ness
 * @license    MIT
 * |-- end copyright and license --|
 * 
 */
'use strict';


/**
 * Blend modes we can draw with, determine how we blend new draws with existing buffer.
 */
const BlendModes = {
    AlphaBlend: "alpha",
    Opaque: "opaque",
    Additive: "additive",
    Multiply: "multiply",
    Subtract: "subtract",
    Screen: "screen",
    Overlay: "overlay",
    DestIn: "dest-in",
    DestOut: "dest-out",
};

Object.defineProperty(BlendModes, '_values', {
    value: new Set(Object.values(BlendModes)),
    writable: false,
});
Object.freeze(BlendModes);

module.exports = BlendModes;
},{}],10:[function(require,module,exports){
/**
 * Camera class.
 * 
 * |-- copyright and license --|
 * @package    Shaku
 * @file       shaku\lib\gfx\camera.js
 * @author     Ronen Ness (ronenness@gmail.com | http://ronenness.com)
 * @copyright  (c) 2021 Ronen Ness
 * @license    MIT
 * |-- end copyright and license --|
 * 
 */
 'use strict';

const Rectangle = require("../utils/rectangle");
const Vector2 = require("../utils/vector2");
const Matrix = require("./matrix");

 /**
  * Implements a Camera object.
  */
class Camera
{
    /**
     * Create the camera.
     * @param {Gfx} gfx The gfx manager instance.
     */
    constructor(gfx)
    {
        /**
         * Camera projection matrix.
         * You can set it manually, or use 'orthographicOffset' / 'orthographic' / 'perspective' helper functions.
         */
        this.projection = null;

        this._gfx = gfx;
        this.orthographic();
        this._viewport = null;
    }

    /**
     * Get camera's viewport (drawing region to set when using this camera).
     * @returns {Rectangle} Camera's viewport as rectangle.
     */
    get viewport()
    {
        return this._viewport;
    }

    /**
     * Set camera's viewport.
     * @param {Rectangle} viewport New viewport to set or null to not use any viewport when using this camera.
     */
    set viewport(viewport)
    {
        this._viewport = viewport;
    }

    /**
     * Make this camera an orthographic camera with offset.
     * @param {Vector2} offset Camera offset (top-left corner).
     * @param {Number} near Near clipping plane.
     * @param {Number} far Far clipping plane.
     */
    orthographicOffset(offset, near, far)
    {
        let region = this._gfx.renderingRegion;
        region.x += offset.x;
        region.y += offset.y;
        this.orthographic(region, near, far);
    }

    /**
     * Make this camera an orthographic camera.
     * @param {Rectangle} region Camera left, top, bottom and right. If not set, will take entire canvas.
     * @param {Number} near Near clipping plane.
     * @param {Number} far Far clipping plane.
     */
    orthographic(region, near, far) 
    {
        if (region === undefined) {
            region = this._gfx.renderingRegion;
        }
        this.projection = Matrix.orthographic(region.left, region.right, region.bottom, region.top, near || -1, far || 400);
    }

    /**
     * Make this camera a perspective camera.
     * @param {*} fieldOfView Field of view angle in radians.
     * @param {*} aspectRatio Aspect ratio.
     * @param {*} near Near clipping plane.
     * @param {*} far Far clipping plane.
     */
    perspective(fieldOfView, aspectRatio, near, far) 
    {
        this.projection = Matrix.perspective(fieldOfView || (Math.PI / 2), aspectRatio || 1, near || 0.1, far || 1000)
    }
}

// export the camera object
module.exports = Camera;
},{"../utils/rectangle":40,"../utils/vector2":41,"./matrix":16}],11:[function(require,module,exports){
/**
 * Implement a basic effect to draw sprites.
 * 
 * |-- copyright and license --|
 * @package    Shaku
 * @file       shaku\lib\gfx\effects\basic.js
 * @author     Ronen Ness (ronenness@gmail.com | http://ronenness.com)
 * @copyright  (c) 2021 Ronen Ness
 * @license    MIT
 * |-- end copyright and license --|
 * 
 */
'use strict';
const Effect = require("./effect");

// vertex shader code
const vertexShader = `
attribute vec3 position;
attribute vec2 coord;
attribute vec4 color;

uniform mat4 projection;
uniform mat4 world;

uniform vec2 uvOffset;
uniform vec2 uvScale;

varying vec2 v_texCoord;
varying vec4 v_color;

void main(void) {
    gl_Position = projection * world * vec4(position, 1.0);
    v_texCoord = uvOffset + (coord * uvScale);
    v_color = color;
}
    `;

// fragment shader code
const fragmentShader = `  
#ifdef GL_ES
    precision highp float;
#endif

uniform sampler2D texture;

varying vec2 v_texCoord;
varying vec4 v_color;

void main(void) {
    gl_FragColor = texture2D(texture, v_texCoord) * v_color;
    gl_FragColor.rgb *= gl_FragColor.a;
}
    `;

/**
 * Default basic effect to draw 2d sprites.
 */
class BasicEffect extends Effect
{
    /** @inheritdoc */
    get vertexCode() 
    { 
        return vertexShader; 
    }

    /** @inheritdoc */
    get fragmentCode()
    { 
        return fragmentShader;
    }

    /** @inheritdoc */
    get uniformTypes()
    {
        return {
            "texture": { type: Effect.UniformTypes.Texture, bind: Effect.UniformBinds.MainTexture },
            "projection": { type: Effect.UniformTypes.Matrix, bind: Effect.UniformBinds.Projection },
            "world": { type: Effect.UniformTypes.Matrix, bind: Effect.UniformBinds.World },
            "uvOffset": { type: Effect.UniformTypes.Float2, bind: Effect.UniformBinds.UvOffset },
            "uvScale": { type: Effect.UniformTypes.Float2, bind: Effect.UniformBinds.UvScale },
        };
    }

    /** @inheritdoc */
    get attributeTypes()
    {
        return {
            "position": { size: 3, type: Effect.AttributeTypes.Float, normalize: false, bind: Effect.AttributeBinds.Position },
            "coord": { size: 2, type: Effect.AttributeTypes.Float, normalize: false, bind: Effect.AttributeBinds.TextureCoords },
            "color": { size: 4, type: Effect.AttributeTypes.Float, normalize: false, bind: Effect.AttributeBinds.Colors },
        };
    }
}


// export the basic shader
module.exports = BasicEffect;
},{"./effect":12}],12:[function(require,module,exports){
/**
 * Effect base class.
 * 
 * |-- copyright and license --|
 * @package    Shaku
 * @file       shaku\lib\gfx\effects\effect.js
 * @author     Ronen Ness (ronenness@gmail.com | http://ronenness.com)
 * @copyright  (c) 2021 Ronen Ness
 * @license    MIT
 * |-- end copyright and license --|
 * 
 */
'use strict';

const TextureAsset = require('../../assets/texture_asset.js');
const Color = require('../../utils/color.js');
const Rectangle = require('../../utils/rectangle.js');
const Matrix = require('../matrix.js');
const _logger = require('../../logger.js').getLogger('gfx-effect');


/**
 * Effect base class.
 * An effect = vertex shader + fragment shader + uniforms & attributes + setup code.
 */
class Effect
{
    /**
     * Build the effect.
     * Called from gfx manager.
     * @private
     * @param {WebGl} gl WebGL context.
     */
    _build(gl)
    {
        // create program
        let program = gl.createProgram();

        // build vertex shader
        {
            let shader = compileShader(gl, this.vertexCode, gl.VERTEX_SHADER);
            gl.attachShader(program, shader);
        }

        // build fragment shader
        {
            let shader = compileShader(gl, this.fragmentCode, gl.FRAGMENT_SHADER);
            gl.attachShader(program, shader);
        }

        // link program
        gl.linkProgram(program)

        // check for errors
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            _logger.error("Error linking shader program:");
            _logger.error(gl.getProgramInfoLog(program));
            throw new Error("Failed to link shader program.");
        }

        // store program and gl
        this._gl = gl;
        this._program = program;

        // a set of dynamically-created setters to set uniform values
        this.uniforms = {};

        // dictionary to bind uniform to built-in roles, like main texture or color
        this._uniformBinds = {};

        // initialize uniform setters
        for (let uniform in this.uniformTypes) {

            // get uniform location
            let uniformLocation = this._gl.getUniformLocation(this._program, uniform);
            if (uniformLocation === -1) { 
                _logger.error("Could not find uniform: " + uniform);
                throw new Error(`Uniform named '${uniform}' was not found in shader code!`); 
            }

            // get gl setter method
            let uniformData = this.uniformTypes[uniform];
            if (!UniformTypes._values.has(uniformData.type)) { 
                _logger.error("Uniform has invalid type: " + uniformData.type);
                throw new Error(`Uniform '${uniform}' have illegal value type '${uniformData.type}'!`); 
            }

            // build setter method for matrices
            if (uniformData.type === UniformTypes.Matrix) {
                (function(_this, name, location, method) {
                    _this.uniforms[name] = (mat) => {
                        _this._gl[method](location, false, mat);
                    }
                })(this, uniform, uniformLocation, uniformData.type);
            }
            // build setter method for other types
            else {
                (function(_this, name, location, method) {
                    _this.uniforms[name] = (v1, v2, v3, v4) => {
                        _this._gl[method](location, v1, v2, v3, v4);
                    }
                })(this, uniform, uniformLocation, uniformData.type);       
            }

            // set binding
            let bindTo = uniformData.bind;
            if (bindTo) {
                this._uniformBinds[bindTo] = uniform;
            }
        }

        // a set of dynamically-created setters to set attribute values
        this.attributes = {};

        // dictionary to bind attribute to built-in roles, like vertices positions or uvs
        this._attributeBinds = {};

        // get attribute locations
        for (let attr in this.attributeTypes) {

            // get attribute location
            let attributeLocation = this._gl.getAttribLocation(this._program, attr);
            if (attributeLocation === -1) { 
                _logger.error("Could not find attribute: " + attr);
                throw new Error(`Attribute named '${attr}' was not found in shader code!`); 
            }

            // get attribute data
            let attributeData = this.attributeTypes[attr];

            // build setter method
            (function(_this, name, location, data) {
                _this.attributes[name] = (buffer) => {
                    if (buffer) {
                        _this._gl.bindBuffer(_this._gl.ARRAY_BUFFER, buffer);
                        _this._gl.vertexAttribPointer(location, data.size, _this._gl[data.type] || _this._gl.FLOAT, data.normalize || false, data.stride || 0, data.offset || 0);
                        _this._gl.enableVertexAttribArray(location);
                    }
                    else {
                        _this._gl.disableVertexAttribArray(location);
                    }
                }
            })(this, attr, attributeLocation, attributeData);
      
            // set binding
            let bindTo = attributeData.bind;
            if (bindTo) {
                this._attributeBinds[bindTo] = attr;
            }
        }

        // values we already set for this effect, so we won't set them again
        this._cachedValues = {};
    }

    /**
     * Get a dictionary with all shaders uniforms.
     * Key = uniform name, as appears in shader code.
     * Value = {
     *              type: UniformTypes to represent uniform type,
     *              bind: Optional bind to one of the built-in uniforms. See Effect.UniformBinds for details.
     *         }
     * @returns {*} Dictionary with uniforms descriptions.
     */
    get uniformTypes()
    {
        throw new Error("Not Implemented!");
    }

    /**
     * Get a dictionary with all shader attributes.
     * Key = attribute name, as appears in shader code.
     * Value = {
     *             size: size of every value in this attribute.
     *             type: attribute type. See Effect.AttributeTypes for details.
     *             normalize: if true, will normalize values.
     *             stride: optional stride. 
     *             offset: optional offset.
     *             bind: Optional bind to one of the built-in attributes. See Effect.AttributeBinds for details.
     *         }
     * @returns {*} Dictionary with attributes descriptions.
     */
    get attributeTypes()
    {
        throw new Error("Not Implemented!");
    }

    /**
     * Make this effect active.
     */
    setAsActive()
    {
        // use effect program
        this._gl.useProgram(this._program);

        // enable / disable some features
        if (this.enableDepthTest) { this._gl.enable(gl.DEPTH_TEST); } else { this._gl.disable(this._gl.DEPTH_TEST); }
        if (this.enableFaceCulling) { this._gl.enable(gl.CULL_FACE); } else { this._gl.disable(this._gl.CULL_FACE); }
        if (this.enableStencilTest) { this._gl.enable(gl.STENCIL_TEST); } else { this._gl.disable(this._gl.STENCIL_TEST); }

        // reset cached values
        this._cachedValues = {};
    }

    /**
     * Prepare effect before drawing it.
     * @param {Mesh} mesh Mesh we're about to draw.
     * @param {Color} color Optional color to set as the color uniform.
     * @param {Matrix} world World matrix.
     * @param {Rectangle} sourceRect Optional source rectangle.
     * @param {TextureAsset} texture Texture asset.
     */
    prepareToDraw(mesh, color, world, sourceRect, texture)
    {
        this.setPositionsAttribute(mesh.positions);
        this.setTextureCoordsAttribute(mesh.textureCoords);
        this.setColorsAttribute(mesh.colors);
        this.setColor(color || Color.white);
        this.setWorldMatrix(world);
        this.setUvOffsetAndScale(sourceRect, texture);
    }

    /**
     * Prepare effect before drawing it with batching.
     * @param {Mesh} mesh Mesh we're about to draw.
     * @param {Matrix} world World matrix.
     */
    prepareToDrawBatch(mesh, world)
    {
        this._cachedValues = {};
        this.setPositionsAttribute(mesh.positions);
        this.setTextureCoordsAttribute(mesh.textureCoords);
        this.setColorsAttribute(mesh.colors);
        this.setWorldMatrix(world);
        this.resetUvOffsetAndScale();
    }

    /**
     * Reset UV offset and scale uniforms.
     */
    resetUvOffsetAndScale()
    {
        // set uv offset
        let uvOffset = this._uniformBinds[Effect.UniformBinds.UvOffset];
        if (uvOffset) {
            this.uniforms[uvOffset](0, 0);
        }
        
        // set uv scale
        let uvScale = this._uniformBinds[Effect.UniformBinds.UvScale];
        if (uvScale) {
            this.uniforms[uvScale](1, 1);
        }

        // reset source rect in cached values
        this._cachedValues.sourceRect = null;
    }

    /**
     * Get this effect's vertex shader code, as string.
     * @returns {String} Vertex shader code. 
     */
    get vertexCode()
    {
        throw new Error("Not Implemented!");
    }

    /**
     * Get this effect's fragment shader code, as string.
     * @returns {String} Fragment shader code. 
     */
    get fragmentCode()
    {
        throw new Error("Not Implemented!");
    }

    /**
     * Should this effect enable depth test?
     */
    get enableDepthTest()
    {
        return false;
    }

    /**
     * Should this effect enable face culling?
     */
    get enableFaceCulling()
    {
        return false;
    }

    /**
     * Should this effect enable stencil test?
     */
    get enableStencilTest()
    {
        return false;
    }

    /**
     * Set the main texture.
     * Only works if there's a uniform type bound to 'MainTexture'.
     * @param {TextureAsset} texture Texture to set.
     * @returns {Boolean} True if texture was changed, false if there was no need to change the texture.
     */
    setTexture(texture)
    {
        let uniform = this._uniformBinds[Effect.UniformBinds.MainTexture];
        if (uniform) {
            if (texture === this._cachedValues.texture) { return false; }
            this._cachedValues.texture = texture;
            let glTexture = texture.texture || texture;
            this._gl.activeTexture(this._gl.TEXTURE0);
            this._gl.bindTexture(this._gl.TEXTURE_2D, glTexture);
            this.uniforms[uniform](glTexture);
            return true;
        }
        return false;
    }

    /**
     * Set the main tint color.
     * Only works if there's a uniform type bound to 'Color'.
     * @param {Color} color Color to set.
     */
    setColor(color)
    {
        let uniform = this._uniformBinds[Effect.UniformBinds.Color];
        if (uniform) {
            if (color.equals(this._cachedValues.color)) { return; }
            this._cachedValues.color = color.clone();
            this.uniforms[uniform](color.floatArray);
        }
    }

    /**
     * Set uvOffset and uvScale params from source rectangle and texture.
     * @param {Rectangle} sourceRect Source rectangle to set, or null to take entire texture.
     * @param {TextureAsset} texture Texture asset to set source rect for.
     */
    setUvOffsetAndScale(sourceRect, texture)
    {
        // skip if the same
        if (sourceRect) {
            if (sourceRect.equals(this._cachedValues.sourceRect)) { return; }
        }
        else {
            if (this._cachedValues.sourceRect === null) { return; }
        }
        this._cachedValues.sourceRect = sourceRect ? sourceRect.clone() : null;

        // default source rect
        if (!sourceRect) { sourceRect = new Rectangle(0, 0, texture.width, texture.height); }

        // set uv offset
        let uvOffset = this._uniformBinds[Effect.UniformBinds.UvOffset];
        if (uvOffset) {
            this.uniforms[uvOffset](sourceRect.x / texture.width, sourceRect.y / texture.height);
        }
        
        // set uv scale
        let uvScale = this._uniformBinds[Effect.UniformBinds.UvScale];
        if (uvScale) {
            this.uniforms[uvScale](sourceRect.width / texture.width, sourceRect.height / texture.height);
        }
    }

    /**
     * Set the projection matrix uniform.
     * @param {Matrix} matrix Matrix to set.
     */
    setProjectionMatrix(matrix)
    {
        let uniform = this._uniformBinds[Effect.UniformBinds.Projection];
        if (uniform) {
            if (matrix.equals(this._cachedValues.projection)) { return; }
            this._cachedValues.projection = matrix.clone();
            this.uniforms[uniform](matrix.values);
        }
    }

    /**
     * Set the world matrix uniform.
     * @param {Matrix} matrix Matrix to set.
     */
    setWorldMatrix(matrix)
    {
        let uniform = this._uniformBinds[Effect.UniformBinds.World];
        if (uniform) {
            this.uniforms[uniform](matrix.values);
        }
    }
     
    /**
     * Set the vertices position buffer.
     * Only works if there's an attribute type bound to 'Position'.
     * @param {WebGLBuffer} buffer Vertices position buffer.
     */
    setPositionsAttribute(buffer)
    {
        let attr = this._attributeBinds[Effect.AttributeBinds.Position];
        if (attr) {
            if (buffer === this._cachedValues.positions) { return; }
            this._cachedValues.positions = buffer;
            this.attributes[attr](buffer);
        }
    }
     
    /**
     * Set the vertices texture coords buffer.
     * Only works if there's an attribute type bound to 'TextureCoords'.
     * @param {WebGLBuffer} buffer Vertices texture coords buffer.
     */
    setTextureCoordsAttribute(buffer)
    {
        let attr = this._attributeBinds[Effect.AttributeBinds.TextureCoords];
        if (attr) {
            if (buffer === this._cachedValues.coords) { return; }
            this._cachedValues.coords = buffer;
            this.attributes[attr](buffer);
        }
    }
         
    /**
     * Set the vertices colors buffer.
     * Only works if there's an attribute type bound to 'Colors'.
     * @param {WebGLBuffer} buffer Vertices colors buffer.
     */
     setColorsAttribute(buffer)
     {
         let attr = this._attributeBinds[Effect.AttributeBinds.Colors];
         if (attr) {
            if (buffer === this._cachedValues.colors) { return; }
            this._cachedValues.colors = buffer;
            this.attributes[attr](buffer);
         }
     }
}

/**
 * Build a shader.
 */
function compileShader(gl, code, type) 
{
    let shader = gl.createShader(type);

    gl.shaderSource(shader, code);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        _logger.error(`Error compiling ${type === gl.VERTEX_SHADER ? "vertex" : "fragment"} shader:`);
        _logger.error(gl.getShaderInfoLog(shader));
        throw new Error("Failed to compile a shader.");
    }

    return shader;
}


/**
 * Uniform types enum.
 */
const UniformTypes = 
{
    Texture: 'uniform1i',
    Matrix: 'uniformMatrix4fv',
    Color: 'uniform4fv',

    Float: 'uniform1f',
    FloatArray: 'uniform1fv',

    Int: 'uniform1i',
    IntArray: 'uniform1iv',

    Float2: 'uniform2f',
    Float2Array: 'uniform2fv',

    Int2: 'uniform2i',
    Int2Array: 'uniform2iv',
    
    Float3: 'uniform3f',
    Float3Array: 'uniform3fv',

    Int3: 'uniform3i',
    Int3Array: 'uniform3iv',
    
    Float4: 'uniform4f',
    Float4Array: 'uniform4fv',

    Int4: 'uniform4i',
    Int4Array: 'uniform4iv',
}
Object.defineProperty(UniformTypes, '_values', {
    value: new Set(Object.values(UniformTypes)),
    writable: false,
});
Object.freeze(UniformTypes);

// attach uniform types to effect
Effect.UniformTypes = UniformTypes;

// define uniform binds - connect uniform name to special usage, like key texture, etc.
Effect.UniformBinds = {
    MainTexture: 'texture',     // bind uniform to be used as the main texture.
    Color: 'color',             // bind uniform to be used as a main color.
    Projection: 'projection',   // bind uniform to be used as the projection matrix.
    World: 'world',             // bind uniform to be used as the world matrix.
    UvOffset: 'uvOffset',       // bind uniform to be used as UV offset.
    UvScale: 'uvScale',         // bind uniform to be used as UV scale.
};
Object.freeze(Effect.UniformBinds);

// define attribute value types.
Effect.AttributeTypes = {
    Byte: 'BYTE',
    Short: 'SHORT',
    UByte: 'UNSIGNED_BYTE',
    UShort: 'UNSIGNED_SHORT',
    Float: 'FLOAT',
    HalfFloat: 'HALF_FLOAT',
};
Object.freeze(Effect.AttributeTypes);

// define attribute binds - connect attribute name to special usage, like position, uvs, etc.
Effect.AttributeBinds = {
    Position: 'position',   // bind attribute to be used for vertices position array.
    TextureCoords: 'uvs',   // bind attribute to be used for texture coords array.
    Colors: 'colors',       // bind attribute to be used for vertices colors array.
}
Object.freeze(Effect.AttributeBinds);


// export the effect class.
module.exports = Effect;
},{"../../assets/texture_asset.js":8,"../../logger.js":28,"../../utils/color.js":37,"../../utils/rectangle.js":40,"../matrix.js":16}],13:[function(require,module,exports){
/**
 * Include all built-in effects.
 * 
 * |-- copyright and license --|
 * @package    Shaku
 * @file       shaku\lib\gfx\effects\index.js
 * @author     Ronen Ness (ronenness@gmail.com | http://ronenness.com)
 * @copyright  (c) 2021 Ronen Ness
 * @license    MIT
 * |-- end copyright and license --|
 * 
 */
 'use strict';

 module.exports = {
    Effect: require('./effect'),
    BasicEffect: require('./basic'),
 }
},{"./basic":11,"./effect":12}],14:[function(require,module,exports){
/**
 * Implement the gfx manager.
 * 
 * |-- copyright and license --|
 * @package    Shaku
 * @file       shaku\lib\gfx\gfx.js
 * @author     Ronen Ness (ronenness@gmail.com | http://ronenness.com)
 * @copyright  (c) 2021 Ronen Ness
 * @license    MIT
 * |-- end copyright and license --|
 * 
 */
'use strict';
const IManager = require('../manager.js');
const Color = require('../utils/color.js');
const BlendModes = require('./blend_modes.js');
const Rectangle = require('../utils/rectangle.js');
const { Effect, BasicEffect } = require('./effects');
const TextureAsset = require('../assets/texture_asset.js');
const TextureFilterModes = require('./texture_filter_modes.js');
const TextureWrapModes = require('./texture_wrap_modes.js');
const MeshGenerator = require('./mesh_generator.js');
const Matrix = require('./matrix.js');
const Camera = require('./camera.js');
const Sprite = require('./sprite.js');
const SpritesGroup = require('./sprites_group.js');
const Vector2 = require('../utils/vector2.js');
const FontTextureAsset = require('../assets/font_texture_asset.js');
const TextAlignment = require('./text_alignment.js');
const Mesh = require('./mesh.js');
const _logger = require('../logger.js').getLogger('gfx');


/**
 * Gfx is the graphics manager. 
 * Everything related to rendering and managing your game canvas goes here.
 * 
 * To access the Graphics manager you use `Shaku.gfx`. 
 */
class Gfx extends IManager
{
    /**
     * Create the manager.
     */
    constructor()
    {
        super();
        this._gl = null;
        this._initSettings = { antialias: false, alpha: true, depth: false, premultipliedAlpha: true };
        this._canvas = null;
        this._lastBlendMode = null;
        this._activeEffect = null;
        this._camera = null;
        this._projection = null;
        this._currIndices = null;
        this._dynamicBuffers = null;
        this._fb = null;
        this.builtinEffects = {};
        this.meshes = {};
        this.defaultTextureFilter = TextureFilterModes.Nearest;
        this.defaultTextureWrapMode = TextureWrapModes.Clamp;
        this.whiteTexture = null;
    }

    /**
     * Get how many sprites we can draw in a single batch.
     * @private
     * @returns {Number} batch max sprites count.
     */
    get batchSpritesCount()
    {
        return 2048;
    }

    /**
     * Maximum number of vertices we allow when drawing lines.
     * @private
     * @returns {Number} max vertices per lines strip.
     */
    get maxLineSegments()
    {
        return 512;
    }

    /**
     * Set WebGL init flags (passed as additional params to the getContext() call). 
     * You must call this *before* initializing *Shaku*.
     * 
     * By default, *Shaku* will init WebGL context with the following flags:
     * - antialias: false.
     * - alpha: true.
     * - depth: false.
     * - premultipliedAlpha: true.
     * @example
     * Shaku.gfx.setContextAttributes({ antialias: true, alpha: false });
     * @param {Dictionary} flags WebGL init flags to set.
     */
    setContextAttributes(flags)
    {
        if (this._gl) { throw new Error("Can't call setContextAttributes() after gfx was initialized!"); }
        this._initSettings = flags;
    }

    /**
     * Set the canvas element to initialize on.
     * You must call this *before* initializing Shaku. Calling this will prevent Shaku from creating its own canvas.
     * @example
     * Shaku.gfx.setCanvas(document.getElementById('my-canvas')); 
     * @param {Canvas} element Canvas element to initialize on.
     */
    setCanvas(element)
    {
        if (this._gl) { throw new Error("Can't call setCanvas() after gfx was initialized!"); }
        this._canvas = element;
    }

    /**
     * Get the canvas element controlled by the gfx manager.
     * If you didn't provide your own canvas before initialization, you must add this canvas to your document after initializing `Shaku`.
     * @example
     * document.body.appendChild(Shaku.gfx.canvas);
     * @returns {Canvas} Canvas we use for rendering.
     */
    get canvas()
    {
        return this._canvas;
    }

    /**
     * Get the Effect base class, which is required to implement custom effects.
     * @see Effect
     */
    get Effect()
    {
        return Effect;
    }

    /**
     * Get the default Effect class, which is required to implement custom effects that inherit and reuse parts from the default effect.
     * @see BasicEffect
     */
    get BasicEffect()
    {
        return BasicEffect;
    }
    
    /**
     * Get the sprite class.
     * @see Sprite
     */
    get Sprite()
    {
        return Sprite;
    }

    /**
     * Get the sprites group object.
     * @see SpritesGroup
     */
    get SpritesGroup()
    {
        return SpritesGroup;
    }

    /**
     * Get the matrix object.
     * @see Matrix
     */
    get Matrix()
    {
        return Matrix;
    }

    /**
     * Get the text alignments options.
     * * Left: align text to the left.
     * * Right: align text to the right.
     * * Center: align text to center.
     * @see TextAlignment
     */
    get TextAlignment()
    {
        return TextAlignment;
    }

    /**
     * Create and return a new camera instance.
     * @param {Boolean} withViewport If true, will create camera with viewport value equal to canvas' size.
     * @returns {Camera} New camera object.
     */
    createCamera(withViewport)
    {
        let ret = new Camera(this);
        if (withViewport) {
            ret.viewport = this.renderingRegion;
        }
        return ret;
    }

    /**
     * Create and return an effect instance.
     * @see Effect
     * @param {Class} type Effect class type. Must inherit from Effect base class.
     * @returns {Effect} Effect instance.
     */
    createEffect(type)
    {
        if (!(type.prototype instanceof Effect)) { throw new Error("'type' must be a class type that inherits from 'Effect'."); }
        let effect = new type();
        effect._build(this._gl);
        return effect;
    }

    /**
     * Set resolution and canvas to the max size of its parent element or screen.
     * If the canvas is directly under document body, it will take the max size of the page.
     * @param {Boolean} limitToParent if true, will use parent element size. If false, will stretch on entire document.
     */
    maximizeCanvasSize(limitToParent)
    {
        // parent
        if (limitToParent) {
            let parent = this._canvas.parentElement;
            let width = parent.clientWidth - this._canvas.offsetLeft;
            let height = parent.clientHeight - this._canvas.offsetTop;
            if ((this._canvas.width !== width) || (this._canvas.height !== height)) {
                this.setResolution(width, height, true);
            }
        }
        // entire screen
        else {
            let width = window.innerWidth;
            let height = window.innerHeight;
            this._canvas.style.left = '0px';
            this._canvas.style.top = '0px';
            if ((this._canvas.width !== width) || (this._canvas.height !== height)) {
                this.setResolution(width, height, true);
            }
        }
    }

    /**
     * Set a render target (texture) to render on.
     * @example
     * // create render target
     * let renderTarget = await Shaku.assets.createRenderTarget('_my_render_target', 800, 600);
     * 
     * // use render target
     * Shaku.gfx.setRenderTarget(renderTarget);
     * // .. draw some stuff here
     * 
     * // reset render target and present it on screen
     * // note the negative height - render targets end up with flipped Y axis
     * Shaku.gfx.setRenderTarget(null);
     * Shaku.gfx.draw(renderTarget, new Shaku.utils.Vector2(screenX / 2, screenY / 2), new Shaku.utils.Vector2(screenX, -screenY));
     * @param {TextureAsset} texture Render target texture to set as render target, or null to reset and render back on canvas.
     */
    setRenderTarget(texture)
    {
        // if texture is null, remove any render target
        if (texture === null) {
            this._gl.bindFramebuffer(this._gl.FRAMEBUFFER, null);
            return;
        }

        // bind the framebuffer
        this._gl.bindFramebuffer(this._gl.FRAMEBUFFER, this._fb);
        
        // attach the texture as the first color attachment
        const attachmentPoint = this._gl.COLOR_ATTACHMENT0;
        this._gl.framebufferTexture2D(
        this._gl.FRAMEBUFFER, attachmentPoint, this._gl.TEXTURE_2D, texture.texture, 0);
    }

    /**
     * Set effect to use for future draw calls.
     * @example
     * let effect = Shaku.gfx.createEffect(MyEffectType);
     * Shaku.gfx.useEffect(effect);
     * @param {Effect} effect Effect to use or null to use the basic builtin effect.
     */
    useEffect(effect)
    {
        // if null, use default
        if (effect === null) {
            this.useEffect(this.builtinEffects.Basic);
            return;
        }

        // same effect? skip
        if (this._activeEffect === effect) {
            return;
        }

        // set effect
        effect.setAsActive();
        this._activeEffect = effect;
        if (this._projection) { this._activeEffect.setProjectionMatrix(this._projection); }
    }

    /**
     * Set resolution and canvas size.
     * @example
     * // set resolution and size of 800x600.
     * Shaku.gfx.setResolution(800, 600, true);
     * @param {Number} width Resolution width.
     * @param {Number} height Resolution height.
     * @param {Boolean} updateCanvasStyle If true, will also update the canvas *css* size in pixels.
     */
    setResolution(width, height, updateCanvasStyle)
    {
        this._canvas.width = width;
        this._canvas.height = height;
        
        if (updateCanvasStyle) {
            this._canvas.style.width = width + 'px';
            this._canvas.style.height = height + 'px';
        }

        this._gl.viewport(0, 0, width, height);

        this.resetCamera();
    }

    /**
     * Reset camera properties to default camera.
     */
    resetCamera()
    {
        this._camera = this.createCamera();
        this.applyCamera(this._camera);
    }

    /**
     * Set viewport, projection and other properties from a camera instance.
     * Changing the camera properties after calling this method will *not* update the renderer, until you call applyCamera again.
     * @param {Camera} camera Camera to apply.
     */
    applyCamera(camera)
    {
        let viewport = camera.viewport || this.renderingRegion;
        this._gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
        this._projection = camera.projection.clone();
        if (this._activeEffect) { this._activeEffect.setProjectionMatrix(this._projection); }
    }

    /**
     * Get rendering region (based on resolution / canvas, without viewport or camera properties).
     * @returns {Rectangle} Rectangle with rendering region.
     */
    get renderingRegion()
    {
        return new Rectangle(0, 0, this._canvas.width, this._canvas.height);
    }

    /**
     * Get canvas size as vector.
     * @returns {Vector2} Canvas size.
     */
    get canvasSize()
    {
        return new Vector2(this._canvas.width, this._canvas.height);
    }

    /** 
     * @inheritdoc
     * @private
     */
    setup()
    {        
        return new Promise(async (resolve, reject) => {  

            _logger.info("Setup gfx manager..");

            // if no canvas is set, create one
            if (!this._canvas) {
                this._canvas = document.createElement('canvas');
            }

            // get gl context
            this._gl = this._canvas.getContext('webgl2', this._initSettings) || this._canvas.getContext('webgl', this._initSettings);
            if (!this._gl) {
                _logger.error("Can't get WebGL context!");
                return reject("Failed to get WebGL context from canvas!");
            }

            // create default effects
            this.builtinEffects.Basic = this.createEffect(BasicEffect);

            // setup textures assets gl context
            TextureAsset._setWebGl(this._gl);

            // create framebuffer (used for render targets)
            this._fb = this._gl.createFramebuffer();

            // create base meshes
            let _meshGenerator = new MeshGenerator(this._gl);
            this.meshes = {
                quad: _meshGenerator.quad()
            }
            Object.freeze(this.meshes);

            // create a useful single white pixel texture
            let whitePixelImage = new Image();
            whitePixelImage.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';
            await new Promise((resolve, reject) => { whitePixelImage.onload = resolve; });
            this.whiteTexture = new TextureAsset('__runtime_white_pixel__');
            this.whiteTexture.fromImage(whitePixelImage);

            // use default effect
            this.useEffect(null);

            // create default camera
            this._camera = this.createCamera();
            this.applyCamera(this._camera);

            // dynamic buffers, used for batch rendering
            this._dynamicBuffers = {
                
                positionBuffer: this._gl.createBuffer(),
                positionArray: new Float32Array(3 * 4 * this.batchSpritesCount),

                textureCoordBuffer: this._gl.createBuffer(),
                textureArray: new Float32Array(2 * 4 * this.batchSpritesCount),

                colorsBuffer: this._gl.createBuffer(),
                colorsArray: new Float32Array(4 * 4 * this.batchSpritesCount),

                indexBuffer: this._gl.createBuffer(),

                linesIndexBuffer: this._gl.createBuffer(),
            }

            // create the indices buffer for batching
            let indices = new Uint16Array(this.batchSpritesCount * 6); // 6 = number of indices per sprite
            let inc = 0;
            for(let i = 0; i < indices.length; i += 6) {
                
                indices[i] = inc;
                indices[i+1] = inc + 1;
                indices[i+2] = inc + 2;

                indices[i+3] = inc + 1;
                indices[i+4] = inc + 3;
                indices[i+5] = inc + 2;

                inc += 4;
            }
            this._gl.bindBuffer(this._gl.ELEMENT_ARRAY_BUFFER, this._dynamicBuffers.indexBuffer);
            this._gl.bufferData(this._gl.ELEMENT_ARRAY_BUFFER, indices, this._gl.STATIC_DRAW);

            // create the indices buffer for drawing lines
            let lineIndices = new Uint16Array(this.maxLineSegments);
            for (let i = 0; i < lineIndices.length; i += 6) {          
                lineIndices[i] = i;
            }
            this._gl.bindBuffer(this._gl.ELEMENT_ARRAY_BUFFER, this._dynamicBuffers.linesIndexBuffer);
            this._gl.bufferData(this._gl.ELEMENT_ARRAY_BUFFER, lineIndices, this._gl.STATIC_DRAW);

            // success!
            resolve();
        });
    }

    /**
     * Generate a sprites group to render a string using a font texture.
     * Take the result of this method and use with gfx.drawGroup() to render the text.
     * This is what you use when you want to draw texts with `Shaku`.
     * Note: its best to always draw texts with *batching* enabled.
     * @example
     * // load font texture
     * let fontTexture = await Shaku.assets.loadFontTexture('assets/DejaVuSansMono.ttf', {fontName: 'DejaVuSansMono'});
     * 
     * // generate 'hello world!' text (note: you don't have to regenerate every frame if text didn't change)
     * let text1 = Shaku.gfx.buildText(fontTexture, "Hello World!");
     * text1.position.set(40, 40);
     * 
     * // draw text
     * Shaku.gfx.drawGroup(text1, true);
     * @param {FontTextureAsset} fontTexture Font texture asset to use.
     * @param {String} text Text to generate sprites for.
     * @param {Number} fontSize Font size, or undefined to use font texture base size.
     * @param {Color} color Text sprites color.
     * @param {TextAlignment} alignment Text alignment.
     * @param {Vector2} marginFactor Optional factor for characters and line spacing. For example value of 2,1 will make double horizontal spacing. 
     * @returns {SpritesGroup} Sprites group containing the needed sprites to draw the given text with its properties.
     */
    buildText(fontTexture, text, fontSize, color, alignment, marginFactor)
    {
        // sanity
        if (!fontTexture || !fontTexture.valid) {
            throw new Error("Font texture is invalid!");
        }
        if (!text) {
            throw new Error("Text is invalid!");
        }

        // default alignment
        alignment = alignment || TextAlignment.Left;

        // default color
        color = color || Color.black;

        // default font size
        fontSize = fontSize || fontTexture.fontSize;

        // default margin factor
        marginFactor = marginFactor || Vector2.one;

        // get character scale factor
        let scale = fontSize / fontTexture.fontSize;

        // current character offset
        let position = new Vector2(0, 0);

        // current line characters and width
        let currentLineSprites = [];
        let lineWidth = 0;

        // go line down
        function breakLine()
        {
            // add offset to update based on alignment
            let offsetX = 0;
            switch (alignment) {

                case TextAlignment.Right:
                    offsetX = -lineWidth;
                    break;

                case TextAlignment.Center:
                    offsetX = -lineWidth / 2;
                    break;

            }

            // if we need to shift characters for alignment, do it
            if (offsetX != 0) {
                for (let i = 0; i < currentLineSprites.length; ++i) {
                    currentLineSprites[i].position.x += offsetX;
                }
            }

            // update offset
            position.x = 0;
            position.y += fontTexture.lineHeight * scale * marginFactor.y;

            // reset line width and sprites
            currentLineSprites = [];
            lineWidth = 0;
        }

        // create group to return and build sprites
        let ret = new SpritesGroup();
        for (let i = 0; i < text.length; ++i) 
        {
            // get character and source rect
            let character = text[i];
            let sourceRect = fontTexture.getSourceRect(character);

            // special case - break line
            if (character === '\n') {
                breakLine();
                continue;
            }

            // calculate character size
            let size = new Vector2(sourceRect.width * scale, sourceRect.height * scale);

            // create sprite (unless its space)
            if (character !== ' ') {

                // create sprite and add to group
                let sprite = new Sprite(fontTexture.texture, sourceRect);
                sprite.size = size;
                sprite.position.copy(position);
                sprite.color.copy(color);
                sprite.origin.x = 0;
                ret.add(sprite);

                // add to current line sprites
                currentLineSprites.push(sprite);
            }

            // update current line width
            lineWidth += size.x * marginFactor.x;

            // set position for next character
            position.x += size.x * marginFactor.x;
        }

        // call break line on last line, to adjust alignment for last line
        breakLine();

        // return group
        return ret;
    }

    /**
     * Draw a SpritesGroup object. 
     * A SpritesGroup is a collection of sprites we can draw in bulks + transformations to apply on the entire group.
     * @example
     * // load texture
     * let texture = await Shaku.assets.loadTexture('assets/sprite.png');
     * 
     * // create group and set entire group's position and scale
     * let group = new Shaku.gfx.SpritesGroup();
     * group.position.set(125, 300);
     * group.scale.set(2, 2);
     *
     * // create 5 sprites and add to group
     * for (let i = 0; i < 5; ++i) {
     *   let sprite = new Shaku.gfx.Sprite(texture);
     *   sprite.position.set(100 * i, 150);
     *   sprite.size.set(50, 50);
     *   group.add(sprite)
     * }
     * 
     * // draw the group with batching
     * Shaku.gfx.drawGroup(group, true);
     * @param {SpritesGroup} group Sprites group to draw.
     * @param {Boolean} useBatching If true (default), will use batching while rendering the group.
     */
    drawGroup(group, useBatching)
    {
        // draw with batching
        if (useBatching || useBatching === undefined) {
            this._drawBatch(group);
        }
        // draw without batching
        else {
            let transform = group.getTransform();
            for (let i = 0; i < group._sprites.length; ++i) {
                this.drawSprite(group._sprites[i], transform);
            }
        }
    }

    /**
     * Draw a single sprite object.
     * Sprites are optional objects that store all the parameters for a `draw()` call. They are also used for batch rendering.
     * @example
     * // load texture and create sprite
     * let texture = await Shaku.assets.loadTexture('assets/sprite.png');
     * let sprite = new Shaku.gfx.Sprite(texture);
     * 
     * // set position and size
     * sprite.position.set(100, 150);
     * sprite.size.set(50, 50);
     * 
     * // draw sprite
     * Shaku.gfx.drawSprite(sprite);
     * @param {Sprite} sprite Sprite object to draw.
     * @param {Matrix} transform Optional parent transformation matrix.
     */
    drawSprite(sprite, transform)
    {
        this.draw(sprite.texture, sprite.position, sprite.size, sprite.sourceRect, sprite.color, sprite.blendMode, sprite.rotation, sprite.origin, transform);
    }

    /**
     * Draw a texture to cover a given destination rectangle.
     * @example
     * // cover the entire screen with an image
     * let texture = await Shaku.assets.loadTexture('assets/sprite.png');
     * Shaku.gfx.cover(texture, Shaku.gfx.renderingRegion);
     * @example
     * // draw with additional params
     * let sourceRect = new Shaku.utils.Rectangle(0, 0, 64, 64);
     * let color = Shaku.utils.Color.blue;
     * let blendMode = Shaku.gfx.BlendModes.Multiply;
     * let rotation = Math.PI / 4;
     * let origin = new Shaku.utils.Vector2(0.5, 0.5);
     * Shaku.gfx.draw(texture, position, size, sourceRect, color, blendMode, rotation, origin);
     * @param {TextureAsset} texture Texture to draw.
     * @param {Rectangle} destRect Destination rectangle to draw on.
     * @param {Rectangle} sourceRect Source rectangle, or undefined to use the entire texture.
     * @param {Color} color Tint color, or undefined to not change color.
     * @param {BlendModes} blendMode Blend mode, or undefined to use alpha blend.
     */
    cover(texture, destRect, sourceRect, color, blendMode)
    {
        return this.draw(texture, destRect.getCenter(), destRect.getSize(), sourceRect, color, blendMode);
    }

    /**
     * Draw a texture.
     * @example
     * // a simple draw with position and size
     * let texture = await Shaku.assets.loadTexture('assets/sprite.png');
     * let position = new Shaku.utils.Vector2(100, 100);
     * let size = new Shaku.utils.Vector2(75, 125); // if width == height, you can pass as a number instead of vector
     * Shaku.gfx.draw(texture, position, size);
     * @example
     * // draw with additional params
     * let sourceRect = new Shaku.utils.Rectangle(0, 0, 64, 64);
     * let color = Shaku.utils.Color.blue;
     * let blendMode = Shaku.gfx.BlendModes.Multiply;
     * let rotation = Math.PI / 4;
     * let origin = new Shaku.utils.Vector2(0.5, 0.5);
     * Shaku.gfx.draw(texture, position, size, sourceRect, color, blendMode, rotation, origin);
     * @param {TextureAsset} texture Texture to draw.
     * @param {Vector2} position Drawing position (at origin).
     * @param {Vector2|Number} size Drawing size.
     * @param {Rectangle} sourceRect Source rectangle, or undefined to use the entire texture.
     * @param {Color} color Tint color, or undefined to not change color.
     * @param {BlendModes} blendMode Blend mode, or undefined to use alpha blend.
     * @param {Number} rotation Rotate sprite.
     * @param {Vector2} origin Drawing origin. This will be the point at 'position' and rotation origin.
     * @param {Matrix} transform Optional parent transformation matrix.
     */
    draw(texture, position, size, sourceRect, color, blendMode, rotation, origin, transform)
    {
        // not ready yet? skip
        if (!texture.texture) { 
            return;
        }

        // if number, convert size to vector
        if (typeof size === 'number') { 
            size = {x: size, y: size};
        }

        // default origin
        if (!origin) {
            origin = Vector2.half;
        }
        
        // build world matrix
        let world;
        if (rotation) { 
            world = Matrix.multiplyManyIntoFirst([
                Matrix.translate(Math.floor(position.x), Math.floor(position.y), 0),
                Matrix.rotateZ(rotation || 0),
                Matrix.translate(Math.floor((1 - origin.x - 0.5) * size.x), Math.floor((1 - origin.y - 0.5) * size.y), 0),
                Matrix.scale(Math.floor(size.x), Math.floor(size.y))
            ]);
        }
        else {
            world = Matrix.multiplyIntoFirst(
                Matrix.translate(Math.floor(position.x + (1 - origin.x - 0.5) * size.x), Math.floor(position.y + (1 - origin.y - 0.5) * size.y), 0),
                Matrix.scale(Math.floor(size.x), Math.floor(size.y))
            );
        }

        // draw
        this._drawImp(texture, sourceRect, color, blendMode, world, transform);
    }

    /**
     * Draw a filled colored rectangle.
     * @example
     * // draw a 50x50 red rectangle at position 100x100, that will rotate over time
     * Shaku.gfx.fillRect(new Shaku.utils.Rectangle(100, 100, 50, 50), Shaku.utils.Color.red, null, Shaku.gameTime.elapsed);
     * @param {Rectangle} destRect Rectangle to fill.
     * @param {Color} color Rectangle fill color.
     * @param {BlendModes} blend Blend mode.
     * @param {Number} rotation Rotate the rectangle around its center.
     */
    fillRect(destRect, color, blend, rotation)
    {
        this.draw(this.whiteTexture, 
            new Vector2(destRect.x + destRect.width / 2, destRect.y + destRect.height / 2),
            new Vector2(destRect.width, destRect.height), null, color, blend || BlendModes.Opaque, rotation, null, null);
    }

    /**
     * Draw a single line between two points.
     * @example
     * Shaku.gfx.drawLine(new Shaku.utils.Vector2(50,50), new Shaku.utils.Vector2(150,50), Shaku.utils.Color.red);
     * @param {Vector2} startPoint Line start point.
     * @param {Vector2} endPoint Line end point.
     * @param {Color} color Line color.
     * @param {BlendModes} blendMode Blend mode to draw lines with (default to Opaque).
     */
    drawLine(startPoint, endPoint, color, blendMode)
    {
        return this.drawLines([startPoint, endPoint], color, blendMode, false);
    }

    /**
     * Draw a strip of lines between an array of points.
     * @example
     * let lines = [new Shaku.utils.Vector2(50,50), new Shaku.utils.Vector2(150,50), new Shaku.utils.Vector2(150,150)];
     * let colors = [Shaku.utils.Color.random(), Shaku.utils.Color.random(), Shaku.utils.Color.random()];
     * Shaku.gfx.drawLines(lines, colors);
     * @param {Array<Vector2>} points Points to draw line between.
     * @param {Color|Array<Color>} colors Single lines color if you want one color for all lines, or an array of colors per segment.
     * @param {BlendModes} blendMode Blend mode to draw lines with (default to Opaque).
     * @param {Boolean} looped If true, will also draw a line from last point back to first point.
     */
    drawLines(points, colors, blendMode, looped)
    {
        // some defaults
        colors = colors || Color.white;
        blendMode = blendMode || BlendModes.Opaque;
        looped = Boolean(looped);

        // sanity
        if (colors.length !== undefined && colors.length !== points.length) {
            throw new Error("When drawing lines with colors array, the colors array and points array must have the same length!");
        }
        if (points.length > this.maxLineSegments) {
            throw new Error(`Cannot draw lines strip with more than ${this.maxLineSegments} vertices!`);
        }

        // basic params
        var gl = this._gl;
        var positionsBuff = this._dynamicBuffers.positionArray;
        var colorsBuff = this._dynamicBuffers.colorsArray;

        for (let i = 0; i < points.length; ++i) {

            // set positions
            positionsBuff[i*3 + 0] = points[i].x;
            positionsBuff[i*3 + 1] = points[i].y;
            positionsBuff[i*3 + 2] = points[i].z || 0;
            
            // set colors
            let color = colors[i] || colors;
            colorsBuff[i*4 + 0] = color.r;
            colorsBuff[i*4 + 1] = color.g;
            colorsBuff[i*4 + 2] = color.b;
            colorsBuff[i*4 + 3] = color.a;
        }

        // set blend mode if needed
        this._setBlendMode(blendMode);

        // prepare effect and texture
        let mesh = new Mesh(this._dynamicBuffers.positionBuffer, null, this._dynamicBuffers.colorsBuffer, this._dynamicBuffers.indexBuffer, points.length);
        this._activeEffect.prepareToDrawBatch(mesh, Matrix.identity);
        this._setActiveTexture(this.whiteTexture);

        // should we slice the arrays?
        let shouldSliceArrays = points.length < this.batchSpritesCount / 2;

        // copy position buffer
        this._gl.bindBuffer(this._gl.ARRAY_BUFFER, this._dynamicBuffers.positionBuffer);
        this._gl.bufferData(this._gl.ARRAY_BUFFER, 
            shouldSliceArrays ? this._dynamicBuffers.positionArray.slice(0, points.length * 3) : this._dynamicBuffers.positionArray, 
            this._gl.DYNAMIC_DRAW);

        // copy color buffer
        this._gl.bindBuffer(this._gl.ARRAY_BUFFER, this._dynamicBuffers.colorsBuffer);
        this._gl.bufferData(this._gl.ARRAY_BUFFER, 
            shouldSliceArrays ? this._dynamicBuffers.colorsArray.slice(0, points.length * 4) : this._dynamicBuffers.colorsArray, 
            this._gl.DYNAMIC_DRAW);

        // set indices
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._dynamicBuffers.linesIndexBuffer);
        this._currIndices = null;

        // draw elements
        let linesType = looped ? gl.LINE_LOOP : gl.LINE_STRIP;
        gl.drawArrays(linesType, 0, points.length);
    }

    /**
     * Draw sprites group as a batch.
     * @private
     * @param {SpritesGroup} group Group to draw.
     */
    _drawBatch(group)
    {
        // skip if empty
        if (group._sprites.length === 0) { return; }

        // get transform and setup effect
        var transform = group.getTransform();

        // basic params
        var gl = this._gl;
        var positions = this._dynamicBuffers.positionArray;
        var uvs = this._dynamicBuffers.textureArray;
        var colors = this._dynamicBuffers.colorsArray;
        var currTexture = null;
        var currBlendMode = null;
        var currBatchSpritesCount = 0;

        // draw the current batch
        let drawCurrentBatch = () =>
        {
            // set blend mode if needed
            this._setBlendMode(currBlendMode);

            // prepare effect and texture
            let mesh = new Mesh(this._dynamicBuffers.positionBuffer, this._dynamicBuffers.textureCoordBuffer, this._dynamicBuffers.colorsBuffer, this._dynamicBuffers.indexBuffer, currBatchSpritesCount * 6);
            this._activeEffect.prepareToDrawBatch(mesh, transform || Matrix.identity);
            this._setActiveTexture(currTexture);

            // should we slice the arrays?
            let shouldSliceArrays = currBatchSpritesCount < this.batchSpritesCount / 2;

            // copy position buffer
            this._gl.bindBuffer(this._gl.ARRAY_BUFFER, this._dynamicBuffers.positionBuffer);
            this._gl.bufferData(this._gl.ARRAY_BUFFER, 
                shouldSliceArrays ? this._dynamicBuffers.positionArray.slice(0, currBatchSpritesCount * 4 * 3) : this._dynamicBuffers.positionArray, 
                this._gl.DYNAMIC_DRAW);

            // copy texture buffer
            this._gl.bindBuffer(this._gl.ARRAY_BUFFER, this._dynamicBuffers.textureCoordBuffer);
            this._gl.bufferData(this._gl.ARRAY_BUFFER, 
                shouldSliceArrays ? this._dynamicBuffers.textureArray.slice(0, currBatchSpritesCount * 4 * 2) : this._dynamicBuffers.textureArray, 
                this._gl.DYNAMIC_DRAW);

            // copy color buffer
            this._gl.bindBuffer(this._gl.ARRAY_BUFFER, this._dynamicBuffers.colorsBuffer);
            this._gl.bufferData(this._gl.ARRAY_BUFFER, 
                shouldSliceArrays ? this._dynamicBuffers.colorsArray.slice(0, currBatchSpritesCount * 4 * 4) : this._dynamicBuffers.colorsArray, 
                this._gl.DYNAMIC_DRAW);

            // set indices
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._dynamicBuffers.indexBuffer);
            this._currIndices = null;

            // draw elements
            gl.drawElements(gl.TRIANGLES, currBatchSpritesCount * 6, gl.UNSIGNED_SHORT, 0);

            // reset arrays
            currBatchSpritesCount = 0;
        }

        // set starting texture and blend mode
        currTexture = group._sprites[0].texture;
        currBlendMode = group._sprites[0].blendMode;

        // draw sprites
        for (let i = 0; i < group._sprites.length; ++i) {

            // get current sprite
            let sprite = group._sprites[i];

            // if texture changed, blend mode changed, or we have too many indices - draw current batch
            if ((currBatchSpritesCount >= this.batchSpritesCount) || (sprite.blendMode !== currBlendMode) || (sprite.texture !== currTexture)) {
                drawCurrentBatch();
                currTexture = sprite.texture;
                currBlendMode = sprite.blendMode;
            }

            // calculate vertices positions
            let sizeX = sprite.size.x;
            let sizeY = sprite.size.y;
            let left = -sizeX * sprite.origin.x;
            let top = -sizeY * sprite.origin.y;

            // calculate corners
            let topLeft = new Vector2(left, top);
            let topRight = new Vector2(left + sizeX, top);
            let bottomLeft = new Vector2(left, top + sizeY);
            let bottomRight = new Vector2(left + sizeX, top + sizeY);

            // apply rotation
            if (sprite.rotation) {
                let cos = Math.cos(sprite.rotation);
                let sin = Math.sin(sprite.rotation);
                function rotateVec(vector)
                {
                    let x = (vector.x * cos - vector.y * sin);
                    let y = (vector.x * sin + vector.y * cos);
                    vector.set(x, y);
                }
                rotateVec(topLeft);
                rotateVec(topRight);
                rotateVec(bottomLeft);
                rotateVec(bottomRight);
            }

            // update positions buffer
            let pi = currBatchSpritesCount * 4 * 3;
            positions[pi+0] = topLeft.x + sprite.position.x;             positions[pi+1] = topLeft.y + sprite.position.y;             positions[pi+2] = 0;
            positions[pi+3] = topRight.x + sprite.position.x;            positions[pi+4] = topRight.y + sprite.position.y;            positions[pi+5] = 0;
            positions[pi+6] = bottomLeft.x + sprite.position.x;          positions[pi+7] = bottomLeft.y + sprite.position.y;          positions[pi+8] = 0;
            positions[pi+9] = bottomRight.x + sprite.position.x;         positions[pi+10] = bottomRight.y + sprite.position.y;        positions[pi+11] = 0;

            // add uvs
            let uvi = currBatchSpritesCount * 4 * 2;
            if (sprite.sourceRect) {
                let uvTl = {x: sprite.sourceRect.x / currTexture.width, y: sprite.sourceRect.y / currTexture.height};
                let uvBr = {x: uvTl.x + sprite.sourceRect.width / currTexture.width, y: uvTl.y + sprite.sourceRect.height / currTexture.height};
                uvs[uvi+0] = uvTl.x;  uvs[uvi+1] = uvTl.y;
                uvs[uvi+2] = uvBr.x;  uvs[uvi+3] = uvTl.y;
                uvs[uvi+4] = uvTl.x;  uvs[uvi+5] = uvBr.y;
                uvs[uvi+6] = uvBr.x;  uvs[uvi+7] = uvBr.y;
            }
            else {
                uvs[uvi+0] = 0;  uvs[uvi+1] = 0;
                uvs[uvi+2] = 1;  uvs[uvi+3] = 0;
                uvs[uvi+4] = 0;  uvs[uvi+5] = 1;
                uvs[uvi+6] = 1;  uvs[uvi+7] = 1;
            }

            // add colors
            let ci = currBatchSpritesCount * 4 * 4;
            for (let x = 0; x < 4; ++x) {
                colors[ci + x*4 + 0] = sprite.color.r;
                colors[ci + x*4 + 1] = sprite.color.g;
                colors[ci + x*4 + 2] = sprite.color.b;
                colors[ci + x*4 + 3] = sprite.color.a;
            }
                    
            // increase sprites count
            currBatchSpritesCount++;
        }

        // draw last batch
        if (currBatchSpritesCount > 0) {
            drawCurrentBatch();
        }
    }

    /**
     * Draw a texture internal implementation.
     * @private
     */
    _drawImp(texture, sourceRect, color, blendMode, world, parentTransform)
    {
        // set blend mode if needed
        this._setBlendMode(blendMode || BlendModes.AlphaBlend);
        
        // add parent to world matrix
        if (parentTransform) {
            world = Matrix.multiply(parentTransform, world);
        }

        // use quad buffers and other effect properties
        let quad = this.meshes.quad;
        quad.overrideColors(this._gl, color || Color.white);
        this._activeEffect.prepareToDraw(quad, color, world, sourceRect, texture)

        // set indices
        if (quad.indices !== this._currIndices) {
        this._gl.bindBuffer(this._gl.ELEMENT_ARRAY_BUFFER, quad.indices);
        this._currIndices = quad.indices;
        }

        // set texture
        this._setActiveTexture(texture);

        // draw sprite
        this._gl.drawArrays(this._gl.TRIANGLE_STRIP, 0, 4);
    }

    /**
     * Set the currently active texture.
     * @private
     * @param {TextureAsset} texture Texture to set.
     */
    _setActiveTexture(texture)
    {
        if (this._activeEffect.setTexture(texture)) {
            this._setTextureFilter(texture.filter || this.defaultTextureFilter);
            this._setTextureWrapMode(texture.wrapMode || this.defaultTextureWrapMode);
        }
    }

    /**
     * Get the blend modes enum.
     * * AlphaBlend
     * * Opaque
     * * Additive
     * * Multiply
     * * Subtract
     * * Screen
     * * Overlay
     * * DestIn
     * * DestOut
     * 
     * ![Blend Modes](resources/blend-modes.png)
     * @see BlendModes
     */
    get BlendModes()
    {
        return BlendModes;
    }
 
    /**
     * Get the wrap modes enum.
     * * Clamp: when uv position exceed texture boundaries it will be clamped to the nearest border, ie repeat the edge pixels.
     * * Repeat: when uv position exceed texture boundaries it will wrap back to the other side.
     * * RepeatMirrored: when uv position exceed texture boundaries it will wrap back to the other side but also mirror the texture.
     * 
     * ![Wrap Modes](resources/wrap-modes.png)
     * @see TextureWrapModes
     */
    get TextureWrapModes()
    {
        return TextureWrapModes;
    }

    /**
     * Get texture filter modes.
     * * Nearest: no filtering, no mipmaps (pixelated).
     * * Linear: simple filtering, no mipmaps (smooth).
     * * NearestMipmapNearest: no filtering, sharp switching between mipmaps,
     * * LinearMipmapNearest: filtering, sharp switching between mipmaps.
     * * NearestMipmapLinear: no filtering, smooth transition between mipmaps.
     * * LinearMipmapLinear: filtering, smooth transition between mipmaps.
     * 
     * ![Filter Modes](resources/filter-modes.png)
     * @see TextureFilterModes
     */
    get TextureFilterModes()
    {
        return TextureFilterModes;
    }

    /**
     * Clear screen to a given color.
     * @example
     * Shaku.gfx.clear(Shaku.utils.Color.cornflowerblue);
     * @param {Color} color Color to clear screen to, or black if not set.
     */
    clear(color)
    {
        color = color || Color.black;
        this._gl.clearColor(color.r, color.g, color.b, color.a);
        this._gl.clear(this._gl.COLOR_BUFFER_BIT | this._gl.DEPTH_BUFFER_BIT);
    }
    
    /**
     * Set texture mag and min filters.
     * @private
     * @param {TextureFilterModes} filter Texture filter to set.
     */
    _setTextureFilter(filter)
    {
        if (!TextureFilterModes._values.has(filter)) { throw new Error("Invalid texture filter mode! Please pick a value from 'TextureFilterModes'."); }
        let glMode = this._gl[filter];
        this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MIN_FILTER, glMode);
        this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MAG_FILTER, glMode);
    }

    /**
     * Set texture wrap mode on X and Y axis.
     * @private
     * @param {WrapModes} wrapX Wrap mode on X axis.
     * @param {WrapModes} wrapY Wrap mode on Y axis.
     */
    _setTextureWrapMode(wrapX, wrapY)
    {
        if (wrapY === undefined) { wrapY = wrapX; }
        if (!TextureWrapModes._values.has(wrapX)) { throw new Error("Invalid texture wrap mode! Please pick a value from 'WrapModes'."); }
        if (!TextureWrapModes._values.has(wrapY)) { throw new Error("Invalid texture wrap mode! Please pick a value from 'WrapModes'."); }
        this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_S, this._gl[wrapX]);
        this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_T, this._gl[wrapY]);
    }

    /**
     * Set blend mode before drawing.
     * @private
     * @param {BlendModes} blendMode New blend mode to set.
     */
    _setBlendMode(blendMode)
    {
        if (this._lastBlendMode !== blendMode) {

            // get gl context and set defaults
            var gl = this._gl;
            gl.enable(gl.BLEND);
            gl.blendEquation(gl.FUNC_ADD);

            switch (blendMode) 
            {
                case BlendModes.AlphaBlend:
                    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
                    break;

                case BlendModes.Opaque:
                    gl.disable(gl.BLEND);
                    break;

                case BlendModes.Additive:
                    gl.blendFunc(gl.ONE, gl.ONE);
                    break;
                    
                case BlendModes.Multiply:
                    gl.blendFuncSeparate(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
                    break;

                case BlendModes.Screen:
                    gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_COLOR, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
                    break;

                case BlendModes.Subtract:
                    gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE);
                    gl.blendEquationSeparate(gl.FUNC_REVERSE_SUBTRACT, gl.FUNC_ADD);
                    break;

                case BlendModes.Overlay:
                    if (gl.MAX) {
                        gl.blendEquation(gl.MAX);
                        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
                    } else {
                        gl.blendFunc(gl.ONE, gl.ONE);
                    }
                    break;

                case BlendModes.DestIn:
                    gl.blendFunc(gl.ZERO, gl.SRC_ALPHA);
                    break;

                case BlendModes.DestOut:
                    gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
                    break;

                default:
                    // gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
                    throw new Error(`Unknown blend mode '${blendMode}'!`);
            }

            // store last blend mode
            this._lastBlendMode = blendMode;
        }
    }
    
    /** 
     * @inheritdoc
     * @private
     */
    startFrame()
    {
        // reset some states
        this._lastBlendMode = null;
    }

    /** 
     * @inheritdoc
     * @private
     */
    endFrame()
    {
    }

    /** 
     * @inheritdoc
     * @private
     */
    destroy()
    {
        _logger.warn("Cleaning up WebGL is not supported yet!");
    }
}

// export main object
module.exports = new Gfx();
},{"../assets/font_texture_asset.js":4,"../assets/texture_asset.js":8,"../logger.js":28,"../manager.js":29,"../utils/color.js":37,"../utils/rectangle.js":40,"../utils/vector2.js":41,"./blend_modes.js":9,"./camera.js":10,"./effects":13,"./matrix.js":16,"./mesh.js":17,"./mesh_generator.js":18,"./sprite.js":19,"./sprites_group.js":20,"./text_alignment.js":21,"./texture_filter_modes.js":22,"./texture_wrap_modes.js":23}],15:[function(require,module,exports){
/**
 * Just an alias to main manager so we can require() this folder as a package.
 * 
 * |-- copyright and license --|
 * @package    Shaku
 * @file       shaku\lib\gfx\index.js
 * @author     Ronen Ness (ronenness@gmail.com | http://ronenness.com)
 * @copyright  (c) 2021 Ronen Ness
 * @license    MIT
 * |-- end copyright and license --|
 * 
 */
 'use strict';
 module.exports = require('./gfx');
},{"./gfx":14}],16:[function(require,module,exports){
/**
 * Matrix class.
 * Based on code from https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Matrix_math_for_the_web
 * 
 * |-- copyright and license --|
 * @package    Shaku
 * @file       shaku\lib\gfx\matrix.js
 * @author     Ronen Ness (ronenness@gmail.com | http://ronenness.com)
 * @copyright  (c) 2021 Ronen Ness
 * @license    MIT
 * |-- end copyright and license --|
 * 
 */
 'use strict';

 /**
  * Implements a matrix.
  */
class Matrix
{
    /**
     * Create the matrix.
     * @param values matrix values array.
     * @param cloneValues if true or undefined, will clone values instead of just holding a reference to them.
     */
    constructor(values, cloneValues)
    {
        if (cloneValues || cloneValues === undefined) {
            this.values = values.slice(0);
        }
        else {
            this.values = values;
        }
    }

    /**
     * Set the matrix values.
     */
     set(v11, v12, v13, v14, v21, v22, v23, v24, v31, v32, v33, v34, v41, v42, v43, v44)
     {
         this.values = new Float32Array([ v11, v12, v13, v14,
                         v21, v22, v23, v24,
                         v31, v32, v33, v34,
                         v41, v42, v43, v44
                     ]);
     }

    /**
     * Clone the matrix.
     * @returns {Matrix} Cloned matrix.
     */
    clone()
    {
        let ret = new Matrix(this.values, true);
        return ret;
    }
    
    /**
     * Compare this matrix to another matrix.
     * @param {Matrix} other Matrix to compare to.
     * @returns {Boolean} If matrices are the same.
     */
    equals(other)
    {
        if (other === this) { return true; }
        if (!other) { return false; }
        for (let i = 0; i < this.values.length; ++i) {
            if (this.values[i] !== other.values[i]) { return false; }
        }
        return true;
    }

    /**
     * Create an orthographic projection matrix.
     * @returns {Matrix} a new matrix with result.
     */
    static orthographic(left, right, bottom, top, near, far) 
    {
        return new Matrix([
          2 / (right - left), 0, 0, 0,
          0, 2 / (top - bottom), 0, 0,
          0, 0, 2 / (near - far), 0,
     
          (left + right) / (left - right),
          (bottom + top) / (bottom - top),
          (near + far) / (near - far),
          1,
        ], false);
    }

    /**
     * Create a perspective projection matrix.
     * @returns {Matrix} a new matrix with result.
     */
    static perspective(fieldOfViewInRadians, aspectRatio, near, far) 
    {
        var f = 1.0 / Math.tan(fieldOfViewInRadians / 2);
        var rangeInv = 1 / (near - far);
      
        return new Matrix([
          f / aspectRatio, 0,                          0,   0,
          0,               f,                          0,   0,
          0,               0,    (near + far) * rangeInv,  -1,
          0,               0,  near * far * rangeInv * 2,   0
        ], false);
    }

    /**
     * Create a translation matrix.
     * @returns {Matrix} a new matrix with result.
     */
    static translate(x, y, z)
    {
        return new Matrix([
            1,          0,          0,          0,
            0,          1,          0,          0,
            0,          0,          1,          0,
            x || 0,     y || 0,     z || 0,     1
        ], false);
    }

    /**
     * Create a scale matrix.
     * @returns {Matrix} a new matrix with result.
     */
    static scale(x, y, z)
    {
        return new Matrix([
            x || 1,         0,              0,              0,
            0,              y || 1,         0,              0,
            0,              0,              z || 1,         0,
            0,              0,              0,              1
        ], false);
    }
    
    /**
     * Create a rotation matrix around X axis.
     * @returns {Matrix} a new matrix with result.
     */
    static rotateX(a)
    {
        let sin = Math.sin;
        let cos = Math.cos;
        return new Matrix([
            1,       0,        0,     0,
            0,  cos(a),  -sin(a),     0,
            0,  sin(a),   cos(a),     0,
            0,       0,        0,     1
        ], false);
    }
        
    /**
     * Create a rotation matrix around Y axis.
     * @returns {Matrix} a new matrix with result.
     */
    static rotateY(a)
    {
        let sin = Math.sin;
        let cos = Math.cos;
        return new Matrix([
             cos(a),   0, sin(a),   0,
                  0,   1,      0,   0,
            -sin(a),   0, cos(a),   0,
                  0,   0,      0,   1
        ], false);
    }
        
    /**
     * Create a rotation matrix around Z axis.
     * @returns {Matrix} a new matrix with result.
     */
    static rotateZ(a)
    {
        let sin = Math.sin;
        let cos = Math.cos;
        return new Matrix([
            cos(a), -sin(a),    0,    0,
            sin(a),  cos(a),    0,    0,
                0,       0,    1,    0,
                0,       0,    0,    1
        ], false);
    }
    
    /**
     * Multiply two matrices. 
     * @returns {Matrix} a new matrix with result.
     */
    static multiply(matrixA, matrixB) 
    {
        // Slice the second matrix up into rows
        let row0 = [matrixB.values[ 0], matrixB.values[ 1], matrixB.values[ 2], matrixB.values[ 3]];
        let row1 = [matrixB.values[ 4], matrixB.values[ 5], matrixB.values[ 6], matrixB.values[ 7]];
        let row2 = [matrixB.values[ 8], matrixB.values[ 9], matrixB.values[10], matrixB.values[11]];
        let row3 = [matrixB.values[12], matrixB.values[13], matrixB.values[14], matrixB.values[15]];
      
        // Multiply each row by matrixA
        let result0 = multiplyMatrixAndPoint(matrixA.values, row0);
        let result1 = multiplyMatrixAndPoint(matrixA.values, row1);
        let result2 = multiplyMatrixAndPoint(matrixA.values, row2);
        let result3 = multiplyMatrixAndPoint(matrixA.values, row3);
      
        // Turn the result rows back into a single matrix
        return new Matrix([
          result0[0], result0[1], result0[2], result0[3],
          result1[0], result1[1], result1[2], result1[3],
          result2[0], result2[1], result2[2], result2[3],
          result3[0], result3[1], result3[2], result3[3]
        ], false);
    }

    /**
     * Multiply an array of matrices.
     * @param {Array<Matrix>} matrices Matrices to multiply.
     * @returns {Matrix} new matrix with multiply result.
     */
    static multiplyMany(matrices)
    {
        let ret = matrices[0];
        for(let i = 1; i < matrices.length; i++) {
            ret = Matrix.multiply(ret, matrices[i]);
        }        
        return ret;
    }
        
    /**
     * Multiply two matrices and put result in first matrix. 
     * @returns {Matrix} matrixA, after it was modified.
     */
    static multiplyIntoFirst(matrixA, matrixB) 
    {
        // Slice the second matrix up into rows
        let row0 = [matrixB.values[ 0], matrixB.values[ 1], matrixB.values[ 2], matrixB.values[ 3]];
        let row1 = [matrixB.values[ 4], matrixB.values[ 5], matrixB.values[ 6], matrixB.values[ 7]];
        let row2 = [matrixB.values[ 8], matrixB.values[ 9], matrixB.values[10], matrixB.values[11]];
        let row3 = [matrixB.values[12], matrixB.values[13], matrixB.values[14], matrixB.values[15]];
    
        // Multiply each row by matrixA
        let result0 = multiplyMatrixAndPoint(matrixA.values, row0);
        let result1 = multiplyMatrixAndPoint(matrixA.values, row1);
        let result2 = multiplyMatrixAndPoint(matrixA.values, row2);
        let result3 = multiplyMatrixAndPoint(matrixA.values, row3);
    
        // Turn the result rows back into a single matrix
        matrixA.set(
            result0[0], result0[1], result0[2], result0[3],
            result1[0], result1[1], result1[2], result1[3],
            result2[0], result2[1], result2[2], result2[3],
            result3[0], result3[1], result3[2], result3[3]
        );

        // return the first matrix after it was modified
        return matrixA;
    }

    /**
     * Multiply an array of matrices into the first matrix in the array.
     * @param {Array<Matrix>} matrices Matrices to multiply.
     * @returns {Matrix} first matrix in array, after it was modified.
     */
     static multiplyManyIntoFirst(matrices)
     {
         let ret = matrices[0];
         for(let i = 1; i < matrices.length; i++) {
             ret = Matrix.multiplyIntoFirst(ret, matrices[i]);
         }        
         return ret;
     }
}


/**
 * Multiply matrix and vector.
 * @private
 */
function multiplyMatrixAndPoint(matrix, point) 
{
    // Give a simple variable name to each part of the matrix, a column and row number
    let c0r0 = matrix[ 0], c1r0 = matrix[ 1], c2r0 = matrix[ 2], c3r0 = matrix[ 3];
    let c0r1 = matrix[ 4], c1r1 = matrix[ 5], c2r1 = matrix[ 6], c3r1 = matrix[ 7];
    let c0r2 = matrix[ 8], c1r2 = matrix[ 9], c2r2 = matrix[10], c3r2 = matrix[11];
    let c0r3 = matrix[12], c1r3 = matrix[13], c2r3 = matrix[14], c3r3 = matrix[15];

    // Now set some simple names for the point
    let x = point[0];
    let y = point[1];
    let z = point[2];
    let w = point[3];

    // Multiply the point against each part of the 1st column, then add together
    let resultX = (x * c0r0) + (y * c0r1) + (z * c0r2) + (w * c0r3);

    // Multiply the point against each part of the 2nd column, then add together
    let resultY = (x * c1r0) + (y * c1r1) + (z * c1r2) + (w * c1r3);

    // Multiply the point against each part of the 3rd column, then add together
    let resultZ = (x * c2r0) + (y * c2r1) + (z * c2r2) + (w * c2r3);

    // Multiply the point against each part of the 4th column, then add together
    let resultW = (x * c3r0) + (y * c3r1) + (z * c3r2) + (w * c3r3);

    return [resultX, resultY, resultZ, resultW];
}


/**
 * An identity matrix.
 */
Matrix.identity = new Matrix([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
], false);
Object.freeze(Matrix.identity);

// export the matrix object
module.exports = Matrix;
},{}],17:[function(require,module,exports){
/**
 * Define a mesh object.
 * 
 * |-- copyright and license --|
 * @package    Shaku
 * @file       shaku\lib\gfx\mesh.js
 * @author     Ronen Ness (ronenness@gmail.com | http://ronenness.com)
 * @copyright  (c) 2021 Ronen Ness
 * @license    MIT
 * |-- end copyright and license --|
 * 
 */
 'use strict';

const { Color } = require("../utils");

 /**
  * Class to hold a mesh.
  */
 class Mesh
 {
    /**
     * Create the mesh object.
     * @param {WebGLBuffer} positions vertices positions buffer. 
     * @param {WebGLBuffer} textureCoords vertices texture coords buffer.
     * @param {WebGLBuffer} colorss vertices colors buffer.
     * @param {WebGLBuffer} indices indices buffer.
     * @param {Number} indicesCount how many indices we have.
     */
    constructor(positions, textureCoords, colorsBuffer, indices, indicesCount)
    {
        this.positions = positions;
        this.textureCoords = textureCoords;
        this.colors = colorsBuffer;
        this.indices = indices;
        this.indicesCount = indicesCount;
        this.__color = new Color(-1, -1, -1, -1);
        Object.freeze(this);
    }

    /**
     * Override the colors buffer, if possible.
     * @param {WebGl} gl WebGL context.
     * @param {Color} color Color to set.
     */
    overrideColors(gl, color)
    {
        if (color.equals(this.__color)) { return; }
        this.__color.copy(color);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.colors);
        const colors = [];
        for (let i = 0; i < this.indicesCount; ++i) {
            colors.push(color.r);
            colors.push(color.g);
            colors.push(color.b);
            colors.push(color.a);
        }
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.DYNAMIC_DRAW);
    }
 }
 
 // export the mesh class.
 module.exports = Mesh;
},{"../utils":39}],18:[function(require,module,exports){
/**
 * Define utility to generate meshes.
 * 
 * |-- copyright and license --|
 * @package    Shaku
 * @file       shaku\lib\gfx\mesh_generator.js
 * @author     Ronen Ness (ronenness@gmail.com | http://ronenness.com)
 * @copyright  (c) 2021 Ronen Ness
 * @license    MIT
 * |-- end copyright and license --|
 * 
 */
'use strict';

const Mesh = require("./mesh");

/**
 * Utility class to generate meshes.
 * @private
 */
class MeshGenerator
{
    /**
     * Create the mesh generator.
     */
    constructor(gl)
    {
        this._gl = gl;
    }

    /**
     * Generate and return a textured quad.
     * @returns {Mesh} Quad mesh.
     */
    quad()
    {
        const gl = this._gl;

        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        let x = 0.5; // <- 0.5 so total size would be 1x1
        const positions = [
            -x, -x,  0,
             x, -x,  0,
            -x,  x,  0,
            x,  x,  0,
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    
        const textureCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
        const textureCoordinates = [
            0.0,  0.0,
            1.0,  0.0,
            0.0,  1.0,
            1.0,  1.0,
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates), gl.STATIC_DRAW);

        const colorsBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, colorsBuffer);
        const colors = [
            1,1,1,1,
            1,1,1,1,
            1,1,1,1,
            1,1,1,1,
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.DYNAMIC_DRAW);
    
        const indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        const indices = [
            0, 1, 3, 2
        ];
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    
        return new Mesh(positionBuffer, textureCoordBuffer, colorsBuffer, indexBuffer, indices.length);
    }
}

// export the meshes generator.
module.exports = MeshGenerator;
},{"./mesh":17}],19:[function(require,module,exports){
/**
 * Define a sprite object.
 * 
 * |-- copyright and license --|
 * @package    Shaku
 * @file       shaku\lib\gfx\sprite.js
 * @author     Ronen Ness (ronenness@gmail.com | http://ronenness.com)
 * @copyright  (c) 2021 Ronen Ness
 * @license    MIT
 * |-- end copyright and license --|
 * 
 */
'use strict';

const TextureAsset = require("../assets/texture_asset");
const Color = require("../utils/color");
const Rectangle = require("../utils/rectangle");
const Vector2 = require("../utils/vector2");
const BlendModes = require("./blend_modes");

/**
 * Sprite class.
 * This object is a helper class to hold all the properties of a texture to render.
 */
class Sprite
{
    /**
     * Create the texture object.
     * @param {TextureAsset} texture Texture asset.
     * @param {Rectangle} sourceRect Optional source rect.
     */
    constructor(texture, sourceRect)
    {
        /**
         * Texture to use for this sprite.
         * @name Sprite#texture
         * @type {TextureAsset}
         */
        this.texture = texture;
        
        /**
         * Sprite position.
         * @name Sprite#position
         * @type {Vector2}
         */
        this.position = new Vector2(0, 0);

        /**
         * Sprite size.
         * @name Sprite#size
         * @type {Vector2}
         */
        this.size = new Vector2(100, 100);

        /**
         * Sprite source rectangle in texture.
         * Null will take entire texture.
         * @name Sprite#sourceRect
         * @type {Rectangle}
         */
        this.sourceRect = sourceRect || null;
        
        /**
         * Sprite blend mode.
         * @name Sprite#blendMode
         * @type {BlendModes}
         */
        this.blendMode = BlendModes.AlphaBlend;
        
        /**
         * Sprite rotation in radians.
         * @name Sprite#rotation
         * @type {Number}
         */
        this.rotation = 0;
        
        /**
         * Sprite origin point.
         * @name Sprite#origin
         * @type {Vector2}
         */
        this.origin = new Vector2(0.5, 0.5);

        /**
         * Sprite color.
         * @name Sprite#color
         * @type {Color}
         */
        this.color = Color.white;
    }
}

// export the sprite class.
module.exports = Sprite;
},{"../assets/texture_asset":8,"../utils/color":37,"../utils/rectangle":40,"../utils/vector2":41,"./blend_modes":9}],20:[function(require,module,exports){
/**
 * Define a sprites group.
 * 
 * |-- copyright and license --|
 * @package    Shaku
 * @file       shaku\lib\gfx\sprites_group.js
 * @author     Ronen Ness (ronenness@gmail.com | http://ronenness.com)
 * @copyright  (c) 2021 Ronen Ness
 * @license    MIT
 * |-- end copyright and license --|
 * 
 */
'use strict';
const Color = require("../utils/color");
const Vector2 = require("../utils/vector2");
const Matrix = require("./matrix");
const Sprite = require("./sprite");


/**
 * Sprites group class.
 * This object is a container to hold sprites collection + parent transformations.
 * You need SpritesGroup to use batched rendering.
 */
class SpritesGroup
{
    /**
     * Create the group object.
     */
    constructor()
    {
        this._sprites = [];
        this.rotation = 0;
        this.position = new Vector2(0, 0);
        this.scale = new Vector2(1, 1);
    }

    /**
     * Iterate all sprites.
     * @param {Function} callback Callback to run on all sprites in group.
     */
    forEach(callback)
    {
        this._sprites.forEach(callback);
    }

    /**
     * Set color for all sprites in group.
     * @param {Color} color Color to set.
     */
    setColor(color)
    {
        for (let i = 0; i < this._sprites.length; ++i) {
            this._sprites[i].color.copy(color);
        }
    }

    /**
     * Get group's transformations.
     * @returns {Matrix} Transformations matrix, or null if there's nothing to apply.
     */
    getTransform()
    {
        let matrices = [];

        if ((this.position.x !== 0) || (this.position.y !== 0)) 
        { 
            matrices.push(Matrix.translate(this.position.x, this.position.y, 0));
        }
        
        if (this.rotation) 
        { 
            matrices.push(Matrix.rotateZ(this.rotation));
        }
        
        if ((this.scale.x !== 1) || (this.scale.y !== 1)) 
        { 
            matrices.push(Matrix.scale(this.scale.x, this.scale.y));
        }

        if (matrices.length === 0) { return null };
        if (matrices.length === 1) { return matrices[0]; }
        return Matrix.multiplyMany(matrices);
    }
    
    /**
     * Adds a sprite to group.
     * @param {Sprite} sprite Sprite to add.
     * @returns {Sprite} The newly added sprite.
     */
    add(sprite)
    {
        this._sprites.push(sprite);
        return sprite;
    }
        
    /**
     * Remove a sprite from group.
     * @param {Sprite} sprite Sprite to remove.
     */
    remove(sprite)
    {
        for (let i = 0; i < this._sprites.length; ++i) {
            if (this._sprites[i] === sprite) {
                this._sprites.splice(i, 1);
                return;
            }
        }
    }

    /**
     * Shift first sprite element.
     * @returns {Sprite} The removed sprite.
     */
    shift()
    {
        return this._sprites.shift();
    }

    /**
     * Sprites count in group.
     * @returns {Number} Number of sprites in group.
     */
    get count()
    {
        return this._sprites.length;
    }
}


// export the sprites group class.
module.exports = SpritesGroup;
},{"../utils/color":37,"../utils/vector2":41,"./matrix":16,"./sprite":19}],21:[function(require,module,exports){
/**
 * Define possible text alignments.
 * 
 * |-- copyright and license --|
 * @package    Shaku
 * @file       shaku\lib\gfx\text_alignment.js
 * @author     Ronen Ness (ronenness@gmail.com | http://ronenness.com)
 * @copyright  (c) 2021 Ronen Ness
 * @license    MIT
 * |-- end copyright and license --|
 * 
 */
'use strict';

/**
 * Possible text alignments.
 */
const TextAlignment = {

    /**
     * Align text left-to-right.
     */
    Left: "left",

    /**
     * Align text right-to-left.
     */
    Right: "right",

    /**
     * Align text to center.
     */
    Center: "center",
};

Object.freeze(TextAlignment);
module.exports = TextAlignment;
},{}],22:[function(require,module,exports){
/**
 * Define possible texture filter modes.
 * 
 * |-- copyright and license --|
 * @package    Shaku
 * @file       shaku\lib\gfx\texture_filter_modes.js
 * @author     Ronen Ness (ronenness@gmail.com | http://ronenness.com)
 * @copyright  (c) 2021 Ronen Ness
 * @license    MIT
 * |-- end copyright and license --|
 * 
 */
 'use strict'; 

/**
 * Texture filter modes, determine how to scale textures.
 */
const TextureFilterModes = {
    Nearest: "NEAREST",
    Linear: "LINEAR",
    NearestMipmapNearest: "NEAREST_MIPMAP_NEAREST",
    LinearMipmapNearest: "LINEAR_MIPMAP_NEAREST",
    NearestMipmapLinear: "NEAREST_MIPMAP_LINEAR",
    LinearMipmapLinear: "LINEAR_MIPMAP_LINEAR",
};

Object.defineProperty(TextureFilterModes, '_values', {
    value: new Set(Object.values(TextureFilterModes)),
    writable: false,
});

Object.freeze(TextureFilterModes);
module.exports = TextureFilterModes;

},{}],23:[function(require,module,exports){
/**
 * Define possible texture wrap modes.
 * 
 * |-- copyright and license --|
 * @package    Shaku
 * @file       shaku\lib\gfx\texture_wrap_modes.js
 * @author     Ronen Ness (ronenness@gmail.com | http://ronenness.com)
 * @copyright  (c) 2021 Ronen Ness
 * @license    MIT
 * |-- end copyright and license --|
 * 
 */
'use strict';

/**
 * Texture wrap modes, determine what to do when texture coordinates are outside texture boundaries.
 */
const TextureWrapModes = {
    Clamp: "CLAMP_TO_EDGE",
    Repeat: "REPEAT",
    RepeatMirrored: "MIRRORED_REPEAT",
};

Object.defineProperty(TextureWrapModes, '_values', {
    value: new Set(Object.values(TextureWrapModes)),
    writable: false,
});

Object.freeze(TextureWrapModes);
module.exports = TextureWrapModes;
},{}],24:[function(require,module,exports){
/**
 * Entry point for the Shaku module.
 * 
 * |-- copyright and license --|
 * @package    Shaku
 * @file       shaku\lib\index.js
 * @author     Ronen Ness (ronenness@gmail.com | http://ronenness.com)
 * @copyright  (c) 2021 Ronen Ness
 * @license    MIT
 * |-- end copyright and license --|
 * 
 */
'use strict';
module.exports = require('./shaku');
},{"./shaku":34}],25:[function(require,module,exports){
/**
 * Just an alias to main manager so we can require() this folder as a package.
 * 
 * |-- copyright and license --|
 * @package    Shaku
 * @file       shaku\lib\input\index.js
 * @author     Ronen Ness (ronenness@gmail.com | http://ronenness.com)
 * @copyright  (c) 2021 Ronen Ness
 * @license    MIT
 * |-- end copyright and license --|
 * 
 */
 'use strict';
 module.exports = require('./input');
},{"./input":26}],26:[function(require,module,exports){
/**
 * Implement the input manager.
 * 
 * |-- copyright and license --|
 * @package    Shaku
 * @file       shaku\lib\input\input.js
 * @author     Ronen Ness (ronenness@gmail.com | http://ronenness.com)
 * @copyright  (c) 2021 Ronen Ness
 * @license    MIT
 * |-- end copyright and license --|
 * 
 */
'use strict';
const IManager = require('../manager.js');
const Vector2 = require('../utils/vector2.js');
const { MouseButtons, KeyboardKeys } = require('./key_codes.js');
const _logger = require('../logger.js').getLogger('input');


/**
 * Input manager. 
 * Used to recieve input from keyboard and mouse.
 * 
 * To access the Input manager use `Shaku.input`. 
 */
class Input extends IManager
{
    /**
     * Create the manager.
     */
    constructor()
    {
        super();
        
        // callbacks and target we listen to input on
        this._callbacks = null;
        this._targetElement = window;

        // export mouse and keyboard keys
        this.MouseButtons = MouseButtons;
        this.KeyboardKeys = KeyboardKeys;

        // if true, will prevent default events by calling preventDefault()
        this.preventDefaults = false;

        // by default, when holding wheel button down browsers will turn into special page scroll mode and will not emit mouse move events.
        // if this property is set to true, StInput will prevent this behavior, so we could still get mouse delta while mouse wheel is held down.
        this.enableMouseDeltaWhileMouseWheelDown = true;

        // if true, will disable the context menu (right click)
        this.disableContextMenu = true;

        // should we reset on focus lost?
        this.resetOnFocusLoss = true;

        // set base state members
        this._resetAll();
    }

    /**
     * @inheritdoc
     * @private
     **/
    setup()
    {        
        return new Promise((resolve, reject) => {

            _logger.info("Setup input manager..");

            // if target element is a method, invoke it
            if (typeof this._targetElement === 'function') {
                this._targetElement = this._targetElement();
                if (!this._targetElement) {
                    throw new Error("Input target element was set to be a method, but the returned value was invalid!");
                }
            }

            // get element to attach to
            let element = this._targetElement;

            // to make sure keyboard input would work if provided with canvas entity
            if (element.tabIndex === -1 || element.tabIndex === undefined) {
                element.tabIndex = 0;
            }

            // set all the events to listen to
            var _this = this;
            this._callbacks = {
                'mousedown': function(event) {_this._onMouseDown(event); if (this.preventDefaults) event.preventDefault(); },
                'mouseup': function(event) {_this._onMouseUp(event); if (this.preventDefaults) event.preventDefault(); },
                'mousemove': function(event) {_this._onMouseMove(event); if (this.preventDefaults) event.preventDefault(); },
                'keydown': function(event) {_this._onKeyDown(event); if (this.preventDefaults) event.preventDefault(); },
                'keyup': function(event) {_this._onKeyUp(event); if (this.preventDefaults) event.preventDefault(); },
                'blur': function(event) {_this._onBlur(event); if (this.preventDefaults) event.preventDefault(); },
                'wheel': function(event) {_this._onMouseWheel(event); },
                'touchstart': function(event) {_this._onTouchStart(event); if (this.preventDefaults) event.preventDefault(); },
                'touchend': function(event) {_this._onMouseUp(event); if (this.preventDefaults) event.preventDefault(); },
                'touchmove': function(event) {_this._onMouseMove(event); if (this.preventDefaults) event.preventDefault(); },
                'contextmenu': function(event) { if (_this.disableContextMenu) { event.preventDefault(); } },
            };

            // reset all data to init initial state
            this._resetAll();
                    
            // register all callbacks
            for (var event in this._callbacks) {
                element.addEventListener(event, this._callbacks[event], false);
            }

            // if we have a specific element, still capture mouse release outside of it
            if (element !== window) {
                window.addEventListener('mouseup', this._callbacks['mouseup'], false);
                window.addEventListener('touchend', this._callbacks['touchend'], false);
            }

            resolve();
        });
    }

    /**
     * @inheritdoc
     * @private
     **/
    startFrame()
    {

    }

    /**
     * @inheritdoc
     * @private
     **/
    destroy()
    {
        // unregister all callbacks
        if (this._callbacks)
        {
            let element = this._targetElement;

            for (var event in this._callbacks) {
                element.removeEventListener(event, this._callbacks[event]);
            }

            if (element !== window) {
                window.removeEventListener('mouseup', this._callbacks['mouseup'], false);
                window.removeEventListener('touchend', this._callbacks['touchend'], false);
            }
            
            this._callbacks = null;
        }
    }

    /**
     * Set the target element to attach input to. If not called, will just use the entire document.
     * Must be called *before* initializing Shaku. This can also be a method to invoke while initializing.
     * @example
     * // the following will use whatever canvas the gfx manager uses as input element.
     * // this means mouse offset will also be relative to this element.
     * Shaku.input.setTargetElement(() => Shaku.gfx.canvas);
     * @param {Element} element Element to attach input to.
     */
    setTargetElement(element)
    {
        if (this._callbacks) { throw new Error("'setTargetElement() must be called before initializing the input manager!"); }
        this._targetElement = element;
    }

    /**
     * Reset all internal data and states.
     * @private
     */
    _resetAll()
    {
        // mouse states
        this._mousePos = new Vector2();
        this._mousePrevPos = new Vector2();
        this._mouseState = {};
        this._mousePrevState = {};
        this._mouseWheel = 0;

        // keyboard keys
        this._keyboardState = {};
        this._keyboardPrevState = {};

        // reset touch started state
        this._touchStarted = false;
    }
    
    /**
     * Get mouse position.
     * @returns {Vector2} Mouse position.
     */
    get mousePosition()
    {
        return this._mousePos.clone();
    }
        
    /**
     * Get mouse previous position (before the last endFrame() call).
     * @returns {Vector2} Mouse position in previous frame.
     */
    get prevMousePosition()
    {
        return (this._mousePrevPos || this._mousePos).clone();
    }

    /**
     * Get mouse movement since last endFrame() call.
     * @returns {Vector2} Mouse change since last frame.
     */
    get mouseDelta()
    {
        // no previous position? return 0,0.
        if (!this._mousePrevPos) {
            return Vector2.zero;
        }

        // return mouse delta
        return new Vector2(this._mousePos.x - this._mousePrevPos.x, this._mousePos.y - this._mousePrevPos.y);
    }

    /**
     * Get if mouse is currently moving.
     * @returns {Boolean} True if mouse moved since last frame, false otherwise.
     */
    get mouseMoving()
    {
        return (this._mousePrevPos && !this._mousePrevPos.equals(this._mousePos));
    }

    /**
     * Get if mouse button was pressed this frame.
     * @param {MouseButtons} button Button code (defults to MouseButtons.left).
     * @returns {Boolean} True if mouse button is currently down, but was up in previous frame.
     */
    mousePressed(button = 0)
    {
        if (button === undefined) throw new Error("Invalid button code!");
        return Boolean(this._mouseState[button] && !this._mousePrevState[button]);
    }

    /**
     * Get if mouse button is currently pressed.
     * @param {MouseButtons} button Button code (defults to MouseButtons.left).  
     * @returns {Boolean} true if mouse button is currently down, false otherwise.
     */
    mouseDown(button = 0)
    {
        if (button === undefined) throw new Error("Invalid button code!");
        return Boolean(this._mouseState[button]);
    }

    /**
     * Get if mouse button is currently not down.
     * @param {MouseButtons} button Button code (defults to MouseButtons.left).
     * @returns {Boolean} true if mouse button is currently up, false otherwise.
     */
    mouseUp(button = 0)
    {
        if (button === undefined) throw new Error("Invalid button code!");
        return Boolean(!this.mouseDown(button));
    }
    
    /**
     * Get if mouse button was released in current frame.
     * @param {MouseButtons} button Button code (defults to MouseButtons.left).
     * @returns {Boolean} True if mouse was down last frame, but released in current frame.
     */
    mouseReleased(button = 0)
    {
        if (button === undefined) throw new Error("Invalid button code!");
        return Boolean(!this._mouseState[button] && this._mousePrevState[button]);
    }

    /**
     * Get if keyboard key is currently pressed down.
     * @param {KeyboardKeys} key Keyboard key code.
     * @returns {boolean} True if keyboard key is currently down, false otherwise.
     */
    keyDown(key)
    {
        if (key === undefined) throw new Error("Invalid key code!");
        return Boolean(this._keyboardState[key]);
    }

    /**
     * Get if keyboard key is currently not down.
     * @param {KeyboardKeys} key Keyboard key code.
     * @returns {Boolean} True if keyboard key is currently up, false otherwise.
     */
    keyUp(key)
    {
        if (key === undefined) throw new Error("Invalid key code!");
        return Boolean(!this.keyDown(key));
    }

    /**
     * Get if a keyboard button was released in current frame.
     * @param {KeyboardKeys} button Keyboard key code.
     * @returns {Boolean} True if key was down last frame, but released in current frame.
     */
    keyReleased(key)
    {
        if (key === undefined) throw new Error("Invalid key code!");
        return Boolean(!this._keyboardState[key] && this._keyboardPrevState[key]);
    }
    
    /**
     * Get if keyboard key was pressed this frame.
     * @param {KeyboardKeys} key Keyboard key code.
     * @returns {Boolean} True if key is currently down, but was up in previous frame.
     */
    keyPressed(key)
    {
        if (key === undefined) throw new Error("Invalid key code!");
        return Boolean(this._keyboardState[key] && !this._keyboardPrevState[key]);
    }

    /**
     * Get if any of the shift keys are currently down.
     * @returns {Boolean} True if there's a shift key pressed down.
     */
    get shiftDown()
    {
        return Boolean(this.keyDown(this.KeyboardKeys.shift));
    }

    /**
     * Get if any of the Ctrl keys are currently down.
     * @returns {Boolean} True if there's a Ctrl key pressed down.
     */
    get ctrlDown()
    {
        return Boolean(this.keyDown(this.KeyboardKeys.ctrl));
    }

    /**
     * Get if any of the Alt keys are currently down.
     * @returns {Boolean} True if there's an Alt key pressed down.
     */
    get altDown()
    {
        return Boolean(this.keyDown(this.KeyboardKeys.alt));
    }

    /**
     * Get if any keyboard key is currently down.
     * @returns {Boolean} True if there's a key pressed down.
     */
    get anyKeyDown()
    {
        for (var key in this._keyboardState) {
            if (this._keyboardState[key]) {
                return true;
            }
        }
        return false;
    }

    /**
     * Get if any mouse button is down.
     * @returns {Boolean} True if any of the mouse buttons are pressed.
     */
    get anyMouseButtonDown()
    {
        for (var key in this._mouseState) {
            if (this._mouseState[key]) {
                return true;
            }
        }
        return false;
    }

    /**
     * Return if a mouse or keyboard state in a generic way, used internally.
     * @private
     * @param {string} code Keyboard or mouse code. 
     *                          For mouse buttons: mouse_left, mouse_right or mouse_middle.
     *                          For keyboard buttons: use one of the keys of KeyboardKeys (for example 'a', 'alt', 'up_arrow', etc..)
     *                          For numbers (0-9): you can use the number.
     * @param {Function} mouseCheck Callback to use to return value if its a mouse button code.
     * @param {Function} keyboardCheck Callback to use to return value if its a keyboard key code.
     */
    _getValueWithCode(code, mouseCheck, keyboardCheck)
    {
        // make sure code is string
        code = String(code);

        // if starts with 'mouse' its for mouse button events
        if (code.indexOf('mouse_') === 0) {

            // get mouse code name
            var codename = code.split('_')[1];

            // return if mouse down
            return mouseCheck.call(this, this.MouseButtons[codename]);
        }

        // if its just a number, add the 'n' prefix
        if (!isNaN(parseInt(code)) && code.length === 1) {
            code = 'n' + code;
        }

        // if not start with 'mouse', treat it as a keyboard key
        return keyboardCheck.call(this, this.KeyboardKeys[code]);
    }

    /**
     * Return if a mouse or keyboard button is currently down.
     * @param {string} code Keyboard or mouse code. 
     *                          For mouse buttons: mouse_left, mouse_right or mouse_middle.
     *                          For keyboard buttons: use one of the keys of KeyboardKeys (for example 'a', 'alt', 'up_arrow', etc..)
     *                          For numbers (0-9): you can use the number.
     * @returns {Boolean} True if key or mouse button are down.
     */
    down(code)
    {
        return Boolean(this._getValueWithCode(code, this.mouseDown, this.keyDown));
    }

    /**
     * Return if a mouse or keyboard button was released in this frame.
     * @param {string} code Keyboard or mouse code. 
     *                          For mouse buttons: mouse_left, mouse_right or mouse_middle.
     *                          For keyboard buttons: use one of the keys of KeyboardKeys (for example 'a', 'alt', 'up_arrow', etc..)
     *                          For numbers (0-9): you can use the number.
     * @returns {Boolean} True if key or mouse button were down in previous frame, and released this frame.
     */
    released(code)
    {
        return Boolean(this._getValueWithCode(code, this.mouseReleased, this.keyReleased));
    }

    /**
     * Return if a mouse or keyboard button was pressed in this frame.
     * @param {string} code Keyboard or mouse code. 
     *                          For mouse buttons: mouse_left, mouse_right or mouse_middle.
     *                          For keyboard buttons: use one of the keys of KeyboardKeys (for example 'a', 'alt', 'up_arrow', etc..)
     *                          For numbers (0-9): you can use the number.
     * @returns {Boolean} True if key or mouse button where up in previous frame, and pressed this frame.
     */
    pressed(code)
    {
        return Boolean(this._getValueWithCode(code, this.mousePressed, this.keyPressed));
    }

    /**
     * Get mouse wheel sign.
     * @returns {Number} Mouse wheel sign (-1 or 1) for wheel scrolling that happened during this frame.
     * Will return 0 if mouse wheel is not currently being used.
     */
    get mouseWheelSign()
    {
        return Math.sign(this._mouseWheel);
    }

    /**
     * Get mouse wheel value.
     * @returns {Number} Mouse wheel value.
     */
    get mouseWheel()
    {
        return this._mouseWheel;
    }

    /**
     * @inheritdoc
     * @private
     **/
    endFrame()
    {
        // set mouse previous position and clear mouse move cache
        this._mousePrevPos = this._mousePos.clone();

        // set previous keyboard state
        this._keyboardPrevState = {};
        for (var key in this._keyboardState) {
            this._keyboardPrevState[key] = this._keyboardState[key];
        }

        // set previous mouse state
        this._mousePrevState = {};
        for (var key in this._mouseState) {
            this._mousePrevState[key] = this._mouseState[key];
        }

        // apply touch start event
        if (this._touchStarted)
        {
            this._mouseState[this.MouseButtons.left] = true;
            this._touchStarted = false;
        }

        // reset mouse wheel
        this._mouseWheel = 0;
    }

    /**
     * Get keyboard key code from event.
     * @private
     */
    _getKeyboardKeyCode(event)
    {
        event = this._getEvent(event);
        return event.keyCode !== undefined ? event.keyCode : event.key.charCodeAt(0);
    }

    /**
     * Called when window loses focus - clear all input states to prevent keys getting stuck.
     * @private
     */
    _onBlur(event)
    {
        if (this.resetOnFocusLoss) {
            this._resetAll();
        }
    }

    /**
     * Handle mouse wheel events.
     * @private
     * @param {*} event Event data from browser.
     */
    _onMouseWheel(event)
    {
        this._mouseWheel = event.deltaY;
    }

    /**
     * Handle keyboard down event.
     * @private
     * @param {*} event Event data from browser.
     */
    _onKeyDown(event)
    {
        var keycode = this._getKeyboardKeyCode(event);
        this._keyboardState[keycode] = true;
    }

    /**
     * Handle keyboard up event.
     * @private
     * @param {*} event Event data from browser.
     */
    _onKeyUp(event)
    {
        var keycode = this._getKeyboardKeyCode(event);
        this._keyboardState[keycode || 0] = false;
    }

    /**
     * Handle touch start event.
     * @private
     * @param {*} event Event data from browser.
     */
    _onTouchStart(event)
    {
        // also update mouse position - this is important for touch events on mobile, where touch move only works while touching,
        // so we want to update mouse position on the moment touch starts
        var touches = event.changedTouches;
        if (touches && touches.length)
        {
            var touch = touches[0];
            var x = touch.pageX || touch.offsetX || touch.clientX;
            var y = touch.pageY || touch.offsetY || touch.clientY;
            if (x !== undefined && y !== undefined) {
                this._mousePos.x = x - this._targetElement.clientX;
                this._mousePos.y = y - this._targetElement.clientY;
            }
        }

        // mark that touch started - will update state next frame
        this._touchStarted = true;
    }

    /**
     * Handle mouse down event.
     * @private
     * @param {*} event Event data from browser.
     */
    _onMouseDown(event)
    {
        // update mouse down state
        event = this._getEvent(event);
        if (this.enableMouseDeltaWhileMouseWheelDown && (event.button === this.MouseButtons.middle))
        { 
            event.preventDefault(); 
        }
        this._mouseState[event.button || 0] = true;
    }

    /**
     * Handle mouse up event.
     * @private
     * @param {*} event Event data from browser.
     */
    _onMouseUp(event)
    {
        event = this._getEvent(event);
        this._mouseState[event.button || 0] = false;
    }

    /**
     * Handle touch move event.
     * @private
     * @param {*} event Event data from browser.
     */
    _onTouchMove(event)
    {
        this._mousePos.x = event.touches[0].pageX;
        this._mousePos.y = event.touches[0].pageY;
        this._normalizeMousePos();
    }

    /**
     * Handle mouse move event.
     * @private
     * @param {*} event Event data from browser.
     */
    _onMouseMove(event)
    {
        // get event in a cross-browser way
        event = this._getEvent(event);

        // try to get position from event with some fallbacks
        var pageX = event.clientX; 
        if (pageX === undefined) { pageX = event.x; } 
        if (pageX === undefined) { pageX = event.offsetX; } 
        if (pageX === undefined) { pageX = event.pageX; }

        var pageY = event.clientY; 
        if (pageY === undefined) { pageY = event.y; } 
        if (pageY === undefined) { pageY = event.offsetY; } 
        if (pageY === undefined) { pageY = event.pageY; }

        // if pageX and pageY are not supported, use clientX and clientY instead
        if (pageX === undefined) {
            pageX = event.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
            pageY = event.clientY + document.body.scrollTop + document.documentElement.scrollTop;
        }

        // set current mouse position
        this._mousePos.x = pageX;
        this._mousePos.y = pageY;
        this._normalizeMousePos();
    }

    /**
     * Normalize current _mousePos value to be relative to target element.
     * @private
     */
    _normalizeMousePos()
    {
        if (this._targetElement.getBoundingClientRect) {
            var rect = this._targetElement.getBoundingClientRect();
            this._mousePos.x -= rect.left;
            this._mousePos.y -= rect.top;
        }
    }

    /**
     * Get event either from event param or from window.event. 
     * This is for older browsers support.
     * @private
     */
    _getEvent(event)
    {
        return event || window.event;
    }
}


// export main object
module.exports = new Input();
},{"../logger.js":28,"../manager.js":29,"../utils/vector2.js":41,"./key_codes.js":27}],27:[function(require,module,exports){
/**
 * Define keyboard and mouse key codes.
 * 
 * |-- copyright and license --|
 * @package    Shaku
 * @file       shaku\lib\input\key_codes.js
 * @author     Ronen Ness (ronenness@gmail.com | http://ronenness.com)
 * @copyright  (c) 2021 Ronen Ness
 * @license    MIT
 * |-- end copyright and license --|
 * 
 */
'use strict';

/**
 * Define mouse button codes.
 */
const MouseButtons = {
    left: 0,
    middle: 1,
    right: 2,
};

/**
 * Define all keyboard key codes.
 */
const KeyboardKeys = {
    backspace: 8,
    tab: 9,
    enter: 13,
    shift: 16,
    ctrl: 17,
    alt: 18,
    break: 19,
    caps_lock: 20,
    escape: 27,
    page_up: 33,
    page_down: 34,
    end: 35,
    home: 36,
    left: 37,
    up: 38,
    right: 39,
    down: 40,
    insert: 45,
    delete: 46,
    space: 32,
    n0: 48,
    n1: 49,
    n2: 50,
    n3: 51,
    n4: 52,
    n5: 53,
    n6: 54,
    n7: 55,
    n8: 56,
    n9: 57,
    a: 65,
    b: 66,
    c: 67,
    d: 68,
    e: 69,
    f: 70,
    g: 71,
    h: 72,
    i: 73,
    j: 74,
    k: 75,
    l: 76,
    m: 77,
    n: 78,
    o: 79,
    p: 80,
    q: 81,
    r: 82,
    s: 83,
    t: 84,
    u: 85,
    v: 86,
    w: 87,
    x: 88,
    y: 89,
    z: 90,
    left_window_key: 91,
    right_window_key: 92,
    select_key: 93,
    numpad_0: 96,
    numpad_1: 97,
    numpad_2: 98,
    numpad_3: 99,
    numpad_4: 100,
    numpad_5: 101,
    numpad_6: 102,
    numpad_7: 103,
    numpad_8: 104,
    numpad_9: 105,
    multiply: 106,
    add: 107,
    subtract: 109,
    decimal_point: 110,
    divide: 111,
    f1: 112,
    f2: 113,
    f3: 114,
    f4: 115,
    f5: 116,
    f6: 117,
    f7: 118,
    f8: 119,
    f9: 120,
    f10: 121,
    f11: 122,
    f12: 123,
    numlock: 144,
    scroll_lock: 145,
    semicolon: 186,
    equal_sign: 187,
    comma: 188,
    dash: 189,
    period: 190,
    forward_slash: 191,
    grave_accent: 192,
    open_bracket: 219,
    back_slash: 220,
    close_braket: 221,
    single_quote: 222,
};

// export keyboard keys and mouse buttons
module.exports = { KeyboardKeys: KeyboardKeys, MouseButtons: MouseButtons };
},{}],28:[function(require,module,exports){
/**
 * Implement basic logger.
 * By default, uses console for logging, but it can be replaced with setDrivers().
 * 
 * |-- copyright and license --|
 * @package    Shaku
 * @file       shaku\lib\logger.js
 * @author     Ronen Ness (ronenness@gmail.com | http://ronenness.com)
 * @copyright  (c) 2021 Ronen Ness
 * @license    MIT
 * |-- end copyright and license --|
 * 
 */
'use strict';

// default logger drivers.
var _drivers = console;

/**
 * A logger manager.
 * By default writes logs to console.
 */
class Logger
{
    constructor(name)
    {
        this._nameHeader = '[Shaku][' + name + ']';
    }

    /**
     * Write a trace level log message.
     * @param {String} msg Message to write.
     */
    trace(msg)
    {
        _drivers.trace(this._nameHeader, msg);
    }

    /**
     * Write a debug level log message.
     * @param {String} msg Message to write.
     */
    debug(msg)
    {
        _drivers.debug(this._nameHeader, msg);
    }

    /**
     * Write an info level log message.
     * @param {String} msg Message to write.
     */
    info(msg)
    {
        _drivers.info(this._nameHeader, msg);
    }

    /**
     * Write a warning level log message.
     * @param {String} msg Message to write.
     */
    warn(msg)
    {
        _drivers.warn(this._nameHeader, msg);
    }

    /**
     * Write an error level log message.
     * @param {String} msg Message to write.
     */
    error(msg)
    {
        _drivers.error(this._nameHeader, msg);
    }
}


/**
 * Null logger drivers to silent logs.
 * @private
 */
class NullDrivers
{
    /**
     * @private
     */
    constructor()
    {
    }
    trace(msg)
    {
    }
    debug(msg)
    {
    }
    info(msg)
    {
    }
    warn(msg)
    {
    }
    error(msg)
    {
    }
}

// export the seeded random class.
module.exports = {

    /**
     * Get a logger object.
     * @param {String} name Logger name.
     */
    getLogger: function(name) {
        return new Logger(name);
    },

    /**
     * Silent the logger.
     */
    silent: function() {
        _drivers = new NullDrivers();
    },

    /**
     * Set log drivers that implement trace, debug, info, warn and error that all loggers will use.
     */
    setDrivers: function(drivers)
    {
        _drivers = drivers;
    }
};
},{}],29:[function(require,module,exports){
/**
 * Define the managers interface.
 * 
 * |-- copyright and license --|
 * @package    Shaku
 * @file       shaku\lib\manager.js
 * @author     Ronen Ness (ronenness@gmail.com | http://ronenness.com)
 * @copyright  (c) 2021 Ronen Ness
 * @license    MIT
 * |-- end copyright and license --|
 * 
 */
'use strict';


/**
 * Interface for any manager.
 * Manager = manages a domain in Shaku, such as gfx (graphics), sfx (sounds), input, etc.
 */
class IManager
{
    /**
     * Initialize the manager.
     * @returns {Promise} Promise to resolve when initialization is done.
     */
    setup()
    {
        throw new Error("Not Implemented!");
    }

    /**
     * Called every update at the begining of the frame.
     */
    startFrame()
    {
        throw new Error("Not Implemented!");
    }

    /**
     * Called every update at the end of the frame.
     */
    endFrame()
    {
        throw new Error("Not Implemented!");
    }

    /**
     * Destroy the manager.
     */
    destroy()
    {
        throw new Error("Not Implemented!");
    }
}

// export the manager interface.
module.exports = IManager
},{}],30:[function(require,module,exports){
/**
 * Just an alias to main manager so we can require() this folder as a package.
 * 
 * |-- copyright and license --|
 * @package    Shaku
 * @file       shaku\lib\sfx\index.js
 * @author     Ronen Ness (ronenness@gmail.com | http://ronenness.com)
 * @copyright  (c) 2021 Ronen Ness
 * @license    MIT
 * |-- end copyright and license --|
 * 
 */
 'use strict';
 module.exports = require('./sfx');
},{"./sfx":31}],31:[function(require,module,exports){
/**
 * Implement the sfx manager.
 * 
 * |-- copyright and license --|
 * @package    Shaku
 * @file       shaku\lib\sfx\sfx.js
 * @author     Ronen Ness (ronenness@gmail.com | http://ronenness.com)
 * @copyright  (c) 2021 Ronen Ness
 * @license    MIT
 * |-- end copyright and license --|
 * 
 */
'use strict';
const SoundAsset = require('../assets/sound_asset.js');
const IManager = require('../manager.js');
const _logger = require('../logger.js').getLogger('sfx');
const SoundInstance = require('./sound_instance.js');
const SoundMixer = require('./sound_mixer.js');
 

/**
 * Sfx manager. 
 * Used to play sound effects and music.
 * 
 * To access the Sfx manager use `Shaku.sfx`. 
 */
class Sfx extends IManager
{
    /**
     * Create the manager.
     */
    constructor()
    {
        super();
        this._playingSounds = null;
    }

    /** 
     * @inheritdoc 
     * @private
     **/
    setup()
    {        
        return new Promise((resolve, reject) => {    
            _logger.info("Setup sfx manager..");
            this._playingSounds = new Set();
            resolve();
        });
    }

    /**
     * Get the SoundMixer class.
     * @see SoundMixer
     */
    get SoundMixer()
    {
        return SoundMixer;
    }

    /** 
     * @inheritdoc 
     * @private
     **/
    startFrame()
    {
        var playingSounds = Array.from(this._playingSounds);
        for (var i = 0; i < playingSounds.length; ++i) {
            var sound = playingSounds[i];
            if (!sound.isPlaying) {
                this._playingSounds.delete(sound);
            }
        }
    }

    /** 
     * @inheritdoc 
     * @private
     **/
    endFrame()
    {
        var playingSounds = Array.from(this._playingSounds);
        for (var i = 0; i < playingSounds.length; ++i) {
            var sound = playingSounds[i];
            if (!sound.isPlaying) {
                this._playingSounds.delete(sound);
            }
        }
    }

    /** 
     * @inheritdoc 
     * @private
     **/
    destroy()
    {
        this.stopAll();
        this._playingSounds = new Set();
    }

    /**
     * Play a sound once without any special properties and without returning a sound instance.
     * Its a more convinient method to play sounds, but less efficient than 'createSound()' if you want to play multiple times.
     * @example
     * let sound = await Shaku.assets.loadSound("assets/my_sound.ogg");
     * Shaku.sfx.play(sound, 0.75);
     * @param {SoundAsset} sound Sound asset to play.
     * @param {Number} volume Volume to play sound (default to max).
     * @param {Number} playbackRate Optional playback rate factor.
     * @param {Boolean} preservesPitch Optional preserve pitch when changing rate factor.
     */
    play(sound, volume, playbackRate, preservesPitch)
    {
        var sound = this.createSound(sound);
        sound.volume = volume !== undefined ? volume : 1;
        if (playbackRate !== undefined) { sound.playbackRate = playbackRate; }
        if (preservesPitch !== undefined) { sound.preservesPitch = preservesPitch; }
        sound.play();
    }

    /**
     * Stop all playing sounds.
     * @example
     * Shaku.sfx.stopAll();
     */
    stopAll()
    {
        var playingSounds = Array.from(this._playingSounds);
        for (var i = 0; i < playingSounds.length; ++i) {
            var sound = playingSounds[i];
            sound.stop();
        }
        this._playingSounds = new Set();
    }

    /**
     * Get currently playing sounds count.
     * @returns {Number} Number of sounds currently playing.
     */
    get playingSoundsCount()
    {
        return this._playingSounds.size;
    }

    /**
     * Create and return a sound instance you can use to play multiple times.
     * @example
     * let sound = await Shaku.assets.loadSound("assets/my_sound.ogg");
     * let soundInstance = Shaku.sfx.createSound(sound);
     * soundInstance.play();
     * @param {SoundAsset} sound Sound asset to play.
     * @returns {SoundInstance} Newly created sound instance.
     */
    createSound(sound)
    {
        if (!(sound instanceof SoundAsset)) { throw new Error("Sound type must be an instance of SoundAsset!"); }
        var ret = new SoundInstance(this, sound.url);
        return ret;
    }

    /**
     * Get master volume.
     * This affect all sound effects volumes.
     * @returns {Number} Current master volume value.
     */
    get masterVolume()
    {
        return SoundInstance._masterVolume;
    }
    
    /**
     * Set master volume.
     * This affect all sound effects volumes.
     * @param {Number} value Master volume to set.
     */
    set masterVolume(value)
    {
        SoundInstance._masterVolume = value;
        return value;
    }
}

// export main object
module.exports = new Sfx();
},{"../assets/sound_asset.js":7,"../logger.js":28,"../manager.js":29,"./sound_instance.js":32,"./sound_mixer.js":33}],32:[function(require,module,exports){
/**
 * Implement a sound effect instance.
 * 
 * |-- copyright and license --|
 * @package    Shaku
 * @file       shaku\lib\sfx\sound_instance.js
 * @author     Ronen Ness (ronenness@gmail.com | http://ronenness.com)
 * @copyright  (c) 2021 Ronen Ness
 * @license    MIT
 * |-- end copyright and license --|
 * 
 */
'use strict';
const _logger = require('../logger.js').getLogger('sfx');


/**
 * A sound effect instance you can play and stop.
 */
class SoundInstance
{
    /**
    * Create a sound instance.
    * @param {Sfx} sfxManager Sfx manager instance.
    * @param {String} url Sound URL or source.
    */
    constructor(sfxManager, url)
    {
        if (!url) {
            _logger.error("Sound type can't be null or invalid!");
            throw new Error("Invalid sound type to play in SoundInstance!");
        }
        this._sfx = sfxManager;
        this._audio = new Audio(url);
        this._volume = 1;
    }

    /**
    * Play sound.
    */
    play()
    {
        if (this.playing) { return; }
        this._audio.play();
        this._sfx._playingSounds.add(this);
    }

    /**
    * Get sound effect playback rate.
    * @returns {Number} Playback rate.
    */
    get playbackRate()
    {
        return this._audio.playbackRate;
    }

    /**
    * Set playback rate.
    * @param {Number} val Playback value to set.
    */
    set playbackRate(val)
    {
        if (val < 0.1) { _logger.error("playbackRate value set is too low, value was capped to 0.1."); }
        if (val > 10) { _logger.error("playbackRate value set is too high, value was capped to 10."); }
        this._audio.playbackRate = val;
    }
    
    /**
    * Get if to preserve pitch while changing playback rate.
    * @returns {Boolean} Preserve pitch state of the sound instance.
    */
    get preservesPitch()
    {
        return Boolean(this._audio.preservesPitch || this._audio.mozPreservesPitch);
    }

    /**
    * Set if to preserve pitch while changing playback rate.
    * @param {Boolean} val New preserve pitch value to set.
    */
    set preservesPitch(val)
    {
        return this._audio.preservesPitch = this._audio.mozPreservesPitch = Boolean(val);
    }

    /**
    * Pause the sound.
    */
    pause()
    {
        this._audio.pause();
    }

    /**
    * Replay sound from start.
    */
    replay()
    {
        this.stop();
        this.play();
    }

    /**
    * Stop the sound and go back to start.
    */
    stop()
    {
        this.pause();
        this.currentTime = 0;
    }

    /**
    * Get if playing in loop.
    * @returns {Boolean} If this sound should play in loop.
    */
    get loop()
    {
        return this._audio.loop;
    }

    /**
    * Set if playing in loop.
    * @param {Boolean} value If this sound should play in loop.
    */
    set loop(value)
    {
        this._audio.loop = value;
        return this._audio.loop;
    }

    /**
    * Get volume.
    * @returns {Number} Sound effect volume.
    */
    get volume()
    {
        return this._volume;
    }

    /**
    * Set volume.
    * @param {Number} value Sound effect volume to set.
    */
    set volume(value)
    {
        this._volume = value;
        var volume = (value * SoundInstance._masterVolume);
        if (volume < 0) { volume = 0; }
        if (volume > 1) { volume = 1; }
        this._audio.volume = volume;
        return this._volume;
    }

    /**
    * Get current time in track.
    * @returns {Number} Current time in playing sound.
    */
    get currentTime()
    {
        return this._audio.currentTime;
    }

    /**
    * Set current time in track.
    * @param {Number} value Set current playing time in sound track.
    */
    set currentTime(value)
    {
        return this._audio.currentTime = value;
    }

    /**
    * Get track duration.
    * @returns {Number} Sound duration in seconds.
    */
    get duration()
    {
        return this._audio.duration;
    }

    /**
    * Get if sound is currently paused.
    * @returns {Boolean} True if sound is currently paused.
    */
    get paused()
    {
        return this._audio.paused;
    }

    /**
    * Get if sound is currently playing.
    * @returns {Boolean} True if sound is currently playing.
    */
    get playing()
    {
        return !this.paused && !this.finished;
    }

    /**
    * Get if finished playing.
    * @returns {Boolean} True if sound reached the end and didn't loop.
    */
    get finished()
    {
        return this._audio.ended;
    }
}


// master volume
SoundInstance._masterVolume = 1;


// export main object
module.exports = SoundInstance;
},{"../logger.js":28}],33:[function(require,module,exports){
/**
 * Implement a sound mixer class.
 * 
 * |-- copyright and license --|
 * @package    Shaku
 * @file       shaku\lib\sfx\sound_mixer.js
 * @author     Ronen Ness (ronenness@gmail.com | http://ronenness.com)
 * @copyright  (c) 2021 Ronen Ness
 * @license    MIT
 * |-- end copyright and license --|
 * 
 */
'use strict';
const SoundInstance = require("./sound_instance.js");


/**
 * A utility class to mix between two sounds.
 */
class SoundMixer
{
    /**
     * Create the sound mixer.
     * @param {SoundInstance} sound1 Sound to mix from. Can be null to just fade in.
     * @param {SoundInstance} sound2 Sound to mix to. Can be null to just fade out.
     * @param {Boolean} allowOverlapping If true (default), will mix while overlapping sounds. 
     *                                   If false, will first finish first sound before begining next.
     */
    constructor(sound1, sound2, allowOverlapping)
    {
        this._sound1 = sound1;
        this._sound2 = sound2;
        this.fromSoundVolume = this._sound1 ? this._sound1.volume : 0;
        this.toSoundVolume = this._sound2 ? this._sound2.volume : 0;
        this.allowOverlapping = allowOverlapping;
        this.update(0);
    }

    /**
     * Stop both sounds.
     */
    stop()
    {
        if (this._sound1) { this._sound1.stop(); }
        if (this._sound2) { this._sound2.stop(); }
    }

    /**
     * Get first sound.
     * @returns {SoundInstance} First sound instance.
     */
    get fromSound()
    {
        return this._sound1;
    }

    /**
     * Get second sound.
     * @returns {SoundInstance} Second sound instance.
     */
    get toSound()
    {
        return this._sound2;
    }

    /**
     * Return current progress.
     * @returns {Number} Mix progress from 0 to 1.
     */
    get progress()
    {
        return this._progress;
    }

    /**
     * Update the mixer progress with time delta instead of absolute value.
     * @param {Number} delta Progress delta, in seconds.
     */
    updateDelta(delta)
    {
        this.update(this._progress + delta);
    }

    /**
     * Update the mixer progress.
     * @param {Number} progress Transition progress from sound1 to sound2. Values must be between 0.0 to 1.0.
     */
    update(progress)
    {
        // special case - start
        if (progress <= 0) {
            if (this._sound1) { 
                this._sound1.volume = this.fromSoundVolume;
            }
            if (this._sound2) {
                this._sound2.volume = 0;
                this._sound2.stop();
            }
            this._progress = 0;
        }
        // special case - finish
        if (progress >= 1) {
            if (this._sound2) {
                this._sound2.volume = this.toSoundVolume;
            }
            if (this._sound1) { 
                this._sound1.volume = 0;
                this._sound1.stop();
            }
            this._progress = 1;
        }
        // transition
        else
        {
            this._progress = progress;
            if (this._sound1) { this._sound1.play(); }
            if (this._sound2) { this._sound2.play(); }

            if (this.allowOverlapping) {
                if (this._sound1) { this._sound1.volume =  this.fromSoundVolume * (1 - progress); }  
                if (this._sound2) { this._sound2.volume =  this.toSoundVolume * progress; }
            }
            else {
                progress *= 2;
                if (this._sound1) { this._sound1.volume =  Math.max(this.fromSoundVolume * (1 - progress), 0); }
                if (this._sound2) { this._sound2.volume =  Math.max(this.toSoundVolume * (progress - 1), 0); }
            }
        }
    }
}

// export the sound mixer
module.exports = SoundMixer;
},{"./sound_instance.js":32}],34:[function(require,module,exports){
/**
 * Shaku Main.
 * 
 * |-- copyright and license --|
 * @package    Shaku
 * @file       shaku\lib\shaku.js
 * @author     Ronen Ness (ronenness@gmail.com | http://ronenness.com)
 * @copyright  (c) 2021 Ronen Ness
 * @license    MIT
 * |-- end copyright and license --|
 * 
 */
'use strict';
const IManager = require("./manager");
const logger = require('./logger');
const sfx = require('./sfx');
const gfx = require('./gfx');
const input = require('./input');
const assets = require('./assets');
const utils = require('./utils');
const GameTime = require("./utils/game_time");

let _usedManagers = null;
let _prevUpdateTime = null;
let _currFpsCounter = 0;
let _countSecond = 0;
let _currFps = 0;

// current version
const version = "1.0.0";

/**
 * Shaku's main object.
 * This object wraps the entire lib namespace, and this is what you use to access all managers and manage your main loop.
 */
class Shaku 
{
    /**
     * Create the Shaku main object.
     */
    constructor()
    {
        // export utils
        this.utils = utils;

        // provide access to all managers
        this.sfx = sfx;
        this.gfx = gfx;
        this.input = input;
        this.assets = assets;
    }

    /**
     * Method to select managers to use + initialize them.
     * @param {Array<IManager>} managers Array with list of managers to use or null to use all.
     * @returns {Promise} promise to resolve when finish initialization.
     */
     async init(managers)
    {
        return new Promise(async (resolve, reject) => {

            // sanity
            if (_usedManagers) { throw new Error("Already initialized!"); }
            
            // reset game start time
            GameTime.resetGameStartTime();

            // setup used managers
            _usedManagers = managers || [assets, sfx, gfx, input];

            // init all managers
            for (let i = 0; i < _usedManagers.length; ++i) {
                await _usedManagers[i].setup();
            }

            // set starting time
            _prevUpdateTime = new GameTime();

            // done!
            resolve();
        });
    }

    /**
     * Destroy all managers
     */
    destroy()
    {
        // sanity
        if (!_usedManagers) { throw new Error("Not initialized!"); }
        
        // destroy all managers
        for (let i = 0; i < _usedManagers.length; ++i) {
            _usedManagers[i].destroy();
        }
    }

    /**
     * Start frame (update all managers).
     */
    startFrame()
    {
        // create new gameTime object
        this._gameTime = new GameTime(_prevUpdateTime);

        // update animators
        utils.Animator.updateAutos(this._gameTime.delta);

        // update managers
        for (let i = 0; i < _usedManagers.length; ++i) {
            _usedManagers[i].startFrame();
        }
    }

    /**
     * End frame (update all managers).
     */
    endFrame()
    {
        // update managers
        for (let i = 0; i < _usedManagers.length; ++i) {
            _usedManagers[i].endFrame();
        }

        // store previous gameTime object
        _prevUpdateTime = this._gameTime;

        // count fps 
        _currFpsCounter++;
        _countSecond += this._gameTime.delta;
        if (_countSecond >= 1) {
            _countSecond = 0;
            _currFps = _currFpsCounter;
            _currFpsCounter = 0;
        }
    }

    /**
     * Make Shaku run in silent mode, without logs.
     */
    silent()
    {
        logger.silent();
    }

    /**
     * Get current frame game time.
     * Only valid between startFrame() and endFrame().
     * @returns {GameTime} Current frame's gametime.
     */
    get gameTime()
    {
        return this._gameTime;
    }

    /**
     * Get Shaku's version.
     * @returns {String} Shaku's version.
     */
    get version() { return version; }

    /**
     * Return current FPS count.
     * Note: will return 0 until at least one second have passed.
     * @returns {Number} FPS count.
     */
    getFpsCount()
    {
        return _currFps;
    }

    /**
     * Request animation frame with fallbacks.
     * @param {Function} callback Method to invoke in next animation frame.
     * @returns {Number} Handle for cancellation.
     */
    requestAnimationFrame(callback) 
    { 
        if (window.requestAnimationFrame) return window.requestAnimationFrame(callback);
        else if (window.mozRequestAnimationFrame) return window.mozRequestAnimationFrame(callback);
        else if (window.webkitRequestAnimationFrame) return window.webkitRequestAnimationFrame(callback);
        else if (window.msRequestAnimationFrame) return window.msRequestAnimationFrame(callback);
        else return setTimeout(callback, 1000/60);
    }
 
    /**
     * Cancel animation frame with fallbacks.
     * @param {Number} id Request handle.
     */
    cancelAnimationFrame(id) {
        if (window.cancelAnimationFrame) return window.cancelAnimationFrame(id);
        else if (window.mozCancelAnimationFrame) return window.mozCancelAnimationFrame(id);
        else clearTimeout(id);
    }
};

// create and return the main object.
module.exports = new Shaku();
},{"./assets":5,"./gfx":15,"./input":25,"./logger":28,"./manager":29,"./sfx":30,"./utils":39,"./utils/game_time":38}],35:[function(require,module,exports){
/**
 * Implement an animator helper class.
 * 
 * |-- copyright and license --|
 * @package    Shaku
 * @file       shaku\lib\utils\animator.js
 * @author     Ronen Ness (ronenness@gmail.com | http://ronenness.com)
 * @copyright  (c) 2021 Ronen Ness
 * @license    MIT
 * |-- end copyright and license --|
 * 
 */
'use strict';
const _autoAnimators = [];


/**
 * Implement an animator object that change values over time using Linear Interpolation.
 * Usage example:
 * (new Animator(sprite)).from({'position.x': 0}).to({'position.x': 100}).duration(1).play();
 */
class Animator
{
    /**
     * Create the animator.
     * @param {*} target Any object you want to animate.
     */
    constructor(target)
    {
        this._target = target;
        this._fromValues = {};
        this._toValues = {};
        this._progress = 0;
        this._onFinish = null;
        this._smoothDamp = false;
        this._repeats = false;
        this._repeatsWithReverseAnimation = false;
        this._isInAutoUpdate = false;
        this._originalFrom = null;
        this._originalTo = null;
        this._originalRepeats = null;

        /**
         * Speed factor to multiply with delta every time this animator updates.
         */
        this.speedFactor = 1;
    }

    /**
     * Update this animator with a given delta time.
     * @param {Number} delta Delta time to progress this animator by.
     */
    update(delta)
    {
        // if already done, skip
        if (this._progress >= 1) {
            return;
        }

        // apply speed factor and update progress
        delta *= this.speedFactor;
        this._progress += delta;

        // did finish?
        if (this._progress >= 1) { 

            // make sure don't overflow
            this._progress = 1; 

            // trigger finish method
            if (this._onFinish) {
                this._onFinish();
            }
        }

        // update values
        for (let key in this._toValues) {

            // get key as parts and to-value
            let keyParts = this._toValues[key].keyParts;
            let toValue = this._toValues[key].value;

            // get from value
            let fromValue = this._fromValues[key];

            // if from not set, get default
            if (fromValue === undefined) {
                this._fromValues[key] = fromValue = this._getValueFromTarget(keyParts);
                if (fromValue === undefined) {
                    throw new Error(`Animator issue: missing origin value for key '${key}' and property not found in target object.`);
                }
            }
            
            // get lerp factor
            let a = (this._smoothDamp && this._progress < 1) ? (this._progress * (1 + 1 - this._progress)) : this._progress;

            // calculate new value
            let newValue = null;
            if (typeof fromValue === 'number') {
                newValue = lerp(fromValue, toValue, a);
            }
            else if (fromValue.constructor.lerp) {
                newValue = fromValue.constructor.lerp(fromValue, toValue, a);
            }
            else {
                throw new Error(`Animator issue: from-value for key '${key}' is not a number, and its class type don't implement a 'lerp()' method!`);
            }

            // set new value
            this._setValueToTarget(keyParts, newValue);
        }

        // if repeating, reset progress
        if (this._repeats && this._progress >= 1) {
            if (typeof this._repeats === 'number') { this._repeats--; }
            this._progress = 0;
            if (this._repeatsWithReverseAnimation ) {
                this.flipFromAndTo();
            }
        }
    }

    /**
     * Get value from target object.
     * @private
     * @param {Array<String>} keyParts Key parts broken by dots.
     */
    _getValueFromTarget(keyParts)
    {
        // easy case - get value when key parts is just one component
        if (keyParts.length === 1) {
            return this._target[keyParts[0]];
        }

        // get value for path with parts
        function index(obj,i) {return obj[i]}
        return keyParts.reduce(index, this._target);
    }

    /**
     * Set value in target object.
     * @private
     * @param {Array<String>} keyParts Key parts broken by dots.
     */
     _setValueToTarget(keyParts, value)
     {
        // easy case - set value when key parts is just one component
        if (keyParts.length === 1) {
            this._target[keyParts[0]] = value;
            return;
        }

        // set value for path with parts
        function index(obj,i) {return obj[i]}
        let parent = keyParts.slice(0, keyParts.length - 1).reduce(index, this._target);
        parent[keyParts[keyParts.length - 1]] = value;
     }

    /**
     * Make sure a given value is legal for the animator.
     * @private
     */
    _validateValueType(value)
    {
        return (typeof value === 'number') || (value && value.constructor && value.constructor.lerp);
    }

    /**
     * Set a method to run when animation ends.
     * @param {Function} callback Callback to invoke when done.
     * @returns {Animator} this.
     */
    then(callback)
    {
        this._onFinish = callback;
        return this;
    }
    
    /**
     * Set smooth damp.
     * If true, lerping will go slower as the animation reach its ending.
     * @param {Boolean} enable set smooth damp mode.
     * @returns {Animator} this.
     */
    smoothDamp(enable)
    {
        this._smoothDamp = enable;
        return this;
    }
        
    /**
     * Set if the animator should repeat itself.
     * @param {Boolean|Number} enable false to disable repeating, true for endless repeats, or a number for limited number of repeats.
     * @param {Boolean} reverseAnimation if true, it will reverse animation to repeat it instead of just "jumping" back to starting state.
     * @returns {Animator} this.
     */
    repeats(enable, reverseAnimation)
    {
        this._originalRepeats = this._repeats = enable;
        this._repeatsWithReverseAnimation = Boolean(reverseAnimation);
        return this;
    }

    /**
     * Set 'from' values.
     * You don't have to provide 'from' values, when a value is not set the animator will just take whatever was set in target when first update is called.
     * @param {*} values Values to set as 'from' values. 
     * Key = property name in target (can contain dots for nested), value = value to start animation from.
     * @returns {Animator} this.
     */
    from(values)
    {
        for (let key in values) {
            if (!this._validateValueType(values[key])) {
                throw new Error("Illegal value type to use with Animator! All values must be either numbers, or a class instance that has a static lerp() method.");
            }
            this._fromValues[key] = values[key];
        }
        this._originalFrom = null;
        return this;
    }

    /**
     * Set 'to' values, ie the result when animation ends.
     * @param {*} values Values to set as 'to' values. 
     * Key = property name in target (can contain dots for nested), value = value to start animation from.
     * @returns {Animator} this.
     */
    to(values)
    {
        for (let key in values) {
            if (!this._validateValueType(values[key])) {
                throw new Error("Illegal value type to use with Animator! All values must be either numbers, or a class instance that has a static lerp() method.");
            }
            this._toValues[key] = {keyParts: key.split('.'), value: values[key]};
        }
        this._originalTo = null;
        return this;
    }

    /**
     * Flip between the 'from' and the 'to' states.
     */
    flipFromAndTo()
    {
        let newFrom = {};
        let newTo = {};

        if (!this._originalFrom) { this._originalFrom = this._fromValues; }
        if (!this._originalTo) { this._originalTo = this._toValues; }

        for (let key in this._toValues) {
            newFrom[key] = this._toValues[key].value;
            newTo[key] = {keyParts: key.split('.'), value: this._fromValues[key]};
        }

        this._fromValues = newFrom;
        this._toValues = newTo;
    }

    /**
     * Make this Animator update automatically with the gameTime delta time.
     * Note: this will change the speedFactor property.
     * @param {Number} seconds Animator duration time in seconds.
     * @returns {Animator} this.
     */
    duration(seconds)
    {
        this.speedFactor = 1 / seconds;
        return this;
    }

    /**
     * Reset animator progress.
     * @returns {Animator} this.
     */
    reset()
    {
        if (this._originalFrom) { this._fromValues = this._originalFrom; }
        if (this._originalTo) { this._toValues = this._originalTo; }
        if (this._originalRepeats !== null) { this._repeats = this._originalRepeats; }
        this._progress = 0;
        return this;
    }

    /**
     * Make this Animator update automatically with the gameTime delta time, until its done.
     * @returns {Animator} this.
     */
    play()
    {
        if (this._isInAutoUpdate) {
            return;
        }

        _autoAnimators.push(this);
        this._isInAutoUpdate = true;
        return this;
    }

    /**
     * Get if this animator finished.
     * @returns {Boolean} True if animator finished.
     */
    get ended()
    {
        return this._progress >= 1;
    }

    /**
     * Update all auto animators.
     * @private
     * @param {Number} delta Delta time in seconds.
     */
    static updateAutos(delta)
    {
        for (let i = _autoAnimators.length - 1; i >= 0; --i) {

            _autoAnimators[i].update(delta);

            if (_autoAnimators[i].ended) {
                _autoAnimators[i]._isInAutoUpdate = false;
                _autoAnimators.splice(i, 1);
            }

        }
    }
}


// a simple lerp method
function lerp(start, end, amt) {
    return (1-amt)*start + amt*end;
}


// export the animator class.
module.exports = Animator;
},{}],36:[function(require,module,exports){
/**
 * Implement a simple 2d circle.
 * 
 * |-- copyright and license --|
 * @package    Shaku
 * @file       shaku\lib\utils\circle.js
 * @author     Ronen Ness (ronenness@gmail.com | http://ronenness.com)
 * @copyright  (c) 2021 Ronen Ness
 * @license    MIT
 * |-- end copyright and license --|
 * 
 */
 'use strict';
const Vector2 = require('./vector2');


/**
 * Implement a simple 2d Circle.
 */
class Circle
{
    /**
     * Create the Circle.
     * @param {Vector2} center Circle center position.
     * @param {Number} radius Circle radius.
     */
    constructor(center, radius)
    {
        this.center = center.clone();
        this.radius = radius;
    }

    /**
     * Return a clone of this circle.
     * @returns {Circle} Cloned circle.
     */
    clone()
    {
        return new Circle(this.center, this.radius);
    }

    /**
     * Check if this circle contains a Vector2.
     * @param {Vector2} p Point to check.
     * @returns {Boolean} if point is contained within the circle.
     */
    containsVector(p) 
    {
        return this.center.distanceTo(p) <= this.radius;
    }

    /**
     * Check if equal to another circle.
     * @param {Circle} other Other circle to compare to.
     * @returns {Boolean} True if circles are equal, false otherwise.
     */
    equals(other)
    {
        return other && this.center.equals(other.center) && this.radius == other.radius;
    }

    /**
     * Lerp between two circle.
     * @param {Vector2} p1 First circle.
     * @param {Vector2} p2 Second circle.
     * @param {Number} a Lerp factor (0.0 - 1.0).
     * @returns {Circle} result circle.
     */
     static lerp(p1, p2, a)
     {
         function lerpScalar(start, end, a)
         {
             return ((1-a) * start) + (a * end);
         }
         return new Circle(Vector2.lerp(p1.center, p2.center, a), lerpScalar(p1.radius, p2.radius, a));
     }
}


// export the circle class
module.exports = Circle;
},{"./vector2":41}],37:[function(require,module,exports){
/**
 * Define a color object.
 * 
 * |-- copyright and license --|
 * @package    Shaku
 * @file       shaku\lib\utils\color.js
 * @author     Ronen Ness (ronenness@gmail.com | http://ronenness.com)
 * @copyright  (c) 2021 Ronen Ness
 * @license    MIT
 * |-- end copyright and license --|
 * 
 */
'use strict';


/**
 * Implement a color.
 * All color components are expected to be in 0.0 - 1.0 range (and not 0-255).
 */
class Color
{
    /**
     * Create the color.
     * @param {Number} r Color red component (value range: 0-1).
     * @param {Number} g Color green component (value range: 0-1).
     * @param {Number} b Color blue component (value range: 0-1).
     * @param {Number} a Color alpha component (value range: 0-1).
     */
    constructor(r, g, b, a)
    {
        this.set(r, g, b, a);
    }

    /**
     * Set the color components.
     * @param {Number} r Color red component (value range: 0-1).
     * @param {Number} g Color green component (value range: 0-1).
     * @param {Number} b Color blue component (value range: 0-1).
     * @param {Number} a Color alpha component (value range: 0-1).
     * @returns {Color} this.
     */
    set(r, g, b, a)
    {
        this._r = r;
        this._g = g;
        this._b = b;
        this._a = (a === undefined) ? 1 : a;
        this._asHex = null;
        return this;
    }

    /**
     * Set the color components from byte values (0-255).
     * @param {Number} r Color red component (value range: 0-255).
     * @param {Number} g Color green component (value range: 0-255).
     * @param {Number} b Color blue component (value range: 0-255).
     * @param {Number} a Color alpha component (value range: 0-255).
     * @returns {Color} this.
     */
    setByte(r, g, b, a)
    {
        this._r = r / 255.0;
        this._g = g / 255.0;
        this._b = b / 255.0;
        this._a = (a === undefined) ? 1 : (a / 255.0);
        this._asHex = null;
        return this;
    }

    /**
     * Copy all component values from another color.
     * @param {Color} other Color to copy values from.
     * @returns {Color} this.
     */
    copy(other)
    {
        this.set(other.r, other.g, other.b, other.a);
        return this;
    }

    /**
     * Get r component.
     * @returns {Number} Red component.
     */
    get r()
    {
        return this._r;
    }

    /**
     * Get g component.
     * @returns {Number} Green component.
     */
    get g()
    {
        return this._g;
    }

    /**
     * Get b component.
     * @returns {Number} Blue component.
     */
    get b()
    {
        return this._b;
    }
    
    /**
     * Get a component.
     * @returns {Number} Alpha component.
     */
    get a()
    {
        return this._a;
    }

    /**
     * Set r component.
     * @returns {Number} Red component after change.
     */
    set r(val)
    {
        this._r = val;
        this._asHex = null;
        return this._r;
    }

    /**
     * Set g component.
     * @returns {Number} Green component after change.
     */
    set g(val)
    {
        this._g = val;
        this._asHex = null;
        return this._g;
    }

    /**
     * Set b component.
     * @returns {Number} Blue component after change.
     */
    set b(val)
    {
        this._b = val;
        this._asHex = null;
        return this._b;
    }
    
    /**
     * Set a component.
     * @returns {Number} Alpha component after change.
     */
    set a(val)
    {
        this._a = val;
        this._asHex = null;
        return this._a;
    }

    /**
     * Convert a single component to hex value.
     * @param {Number} c Value to convert to hex.
     * @returns {String} Component as hex value.
     */
    static componentToHex(c) 
    {
        var hex = Math.round(c).toString(16);
        return hex.length == 1 ? "0" + hex : hex;
    }
     
    /**
     * Convert this color to hex string (starting with '#').
     * @returns {String} Color as hex.
     */
    get asHex() 
    {
        if (!this._asHex) {
            this._asHex = "#" + Color.componentToHex(this.r * 255) + Color.componentToHex(this.g * 255) + Color.componentToHex(this.b * 255) + Color.componentToHex(this.a * 255);
        }
        return this._asHex;
    }

    /**
     * Create color from hex value.
     * @param {Number} val Number value (hex), as 0xrrggbbaa.
     * @returns {Color} New color value.
     */
    static fromHex(val)
    {
        if (typeof val !== 'string' && val[0] != '#') {
            throw new PintarJS.Error("Invalid color format!");
        }
        var parsed = hexToColor(val);
        if (!parsed) { throw new Error("Invalid hex value to parse!"); }
        return new Color(parsed.r, parsed.g, parsed.b, 1);
    }

    /**
     * Create color from decimal value.
     * @param {Number} val Number value (int).
     * @param {Number} includeAlpha If true, will include alpha value.
     * @returns {Color} New color value.
     */
    static fromDecimal(val, includeAlpha)
    {
        let ret = new Color(1, 1, 1, 1);
        if (includeAlpha) { ret.a = (val & 0xff) / 255.0; val = val >> 8; }
        ret.b = (val & 0xff) / 255.0; val = val >> 8;
        ret.g = (val & 0xff) / 255.0; val = val >> 8;
        ret.r = (val & 0xff) / 255.0;
    }

    /**
     * Convert this color to decimal number.
     * @returns {Number} Color as decimal RGBA.
     */
    get asDecimalRGBA()
    {
      return ((Math.round(this.r * 255) << (8 * 3)) | (Math.round(this.g * 255) << (8 * 2)) | (Math.round(this.b * 255) << (8 * 1)) | (Math.round(this.a * 255)))>>>0;
    }

    /**
     * Convert this color to decimal number.
     * @returns {Number} Color as decimal ARGB.
     */
    get asDecimalABGR()
    {
      return ((Math.round(this.a * 255) << (8 * 3)) | (Math.round(this.b * 255) << (8 * 2)) | (Math.round(this.g * 255) << (8 * 1)) | (Math.round(this.r * 255)))>>>0;
    }

    /**
     * Convert this color to a float array.
     */
    get floatArray()
    {
        return [this.r, this.g, this.b, this.a];
    }

    /**
     * Return a clone of this color.
     * @returns {Number} Cloned color.
     */
    clone()
    {
        return new Color(this.r, this.g, this.b, this.a);
    }

    /**
     * Convert to string.
     */
    string() 
    {
        return this.r + ',' + this.g + ',' + this.b + ',' + this.a;
    }

    /**
     * Get if this color is pure black (ignoring alpha).
     */
    get isBlack()
    {
        return this.r == 0 && this.g == 0 && this.b == 0;
    }

    /**
     * Return a random color.
     * @param {Boolean} includeAlpha If true, will also randomize alpha.
     * @returns {Color} Randomized color.
     */
    static random(includeAlpha)
    {
        return new Color(Math.random(), Math.random(), Math.random(), includeAlpha ? Math.random() : 1);
    }

    /**
     * Build and return new color from bytes array.
     * @param {Array<Number>} bytes Bytes array to build color from.
     * @returns {Color} Newly created color.
     */
    static fromBytesArray(bytes)
    {
        return new Color(bytes[0] / 255, bytes[1] / 255, bytes[2] / 255, (bytes[3] / 255) || 1);
    }

    /**
     * Get if this color is transparent black.
     */
    get isTransparentBlack()
    {
        return this._r == this._g && this._g == this._b && this._b == this._a && this._a == 0;
    }

    /**
     * Check if equal to another color.
     * @param {PintarJS.Color} other Other color to compare to.
     */
    equals(other)
    {
        return other && this._r == other._r && this._g == other._g && this._b == other._b && this._a == other._a;
    }

    /**
     * Lerp between two colors.
     * @param {Vector2} p1 First color.
     * @param {Vector2} p2 Second color.
     * @param {Number} a Lerp factor (0.0 - 1.0).
     * @returns {Color} result color.
     */
     static lerp(p1, p2, a)
     {
         function lerpScalar(start, end, a)
         {
             return ((1-a) * start) + (a * end);
         }
         return new Color(  lerpScalar(p1.r, p2.r, a), 
                            lerpScalar(p1.g, p2.g, a), 
                            lerpScalar(p1.b, p2.b, a), 
                            lerpScalar(p1.a, p2.a, a)
                        );
     }
}

// table to convert common color names to hex
const colorNameToHex = {"aliceblue":"#f0f8ff","antiquewhite":"#faebd7","aqua":"#00ffff","aquamarine":"#7fffd4","azure":"#f0ffff",
    "beige":"#f5f5dc","bisque":"#ffe4c4","black":"#000000","blanchedalmond":"#ffebcd","blue":"#0000ff","blueviolet":"#8a2be2","brown":"#a52a2a","burlywood":"#deb887",
    "cadetblue":"#5f9ea0","chartreuse":"#7fff00","chocolate":"#d2691e","coral":"#ff7f50","cornflowerblue":"#6495ed","cornsilk":"#fff8dc","crimson":"#dc143c","cyan":"#00ffff",
    "darkblue":"#00008b","darkcyan":"#008b8b","darkgoldenrod":"#b8860b","darkgray":"#a9a9a9","darkgreen":"#006400","darkkhaki":"#bdb76b","darkmagenta":"#8b008b","darkolivegreen":"#556b2f",
    "darkorange":"#ff8c00","darkorchid":"#9932cc","darkred":"#8b0000","darksalmon":"#e9967a","darkseagreen":"#8fbc8f","darkslateblue":"#483d8b","darkslategray":"#2f4f4f","darkturquoise":"#00ced1",
    "darkviolet":"#9400d3","deeppink":"#ff1493","deepskyblue":"#00bfff","dimgray":"#696969","dodgerblue":"#1e90ff",
    "firebrick":"#b22222","floralwhite":"#fffaf0","forestgreen":"#228b22","fuchsia":"#ff00ff",
    "gainsboro":"#dcdcdc","ghostwhite":"#f8f8ff","gold":"#ffd700","goldenrod":"#daa520","gray":"#808080","green":"#008000","greenyellow":"#adff2f",
    "honeydew":"#f0fff0","hotpink":"#ff69b4",
    "indianred ":"#cd5c5c","indigo":"#4b0082","ivory":"#fffff0","khaki":"#f0e68c",
    "lavender":"#e6e6fa","lavenderblush":"#fff0f5","lawngreen":"#7cfc00","lemonchiffon":"#fffacd","lightblue":"#add8e6","lightcoral":"#f08080","lightcyan":"#e0ffff","lightgoldenrodyellow":"#fafad2",
    "lightgrey":"#d3d3d3","lightgreen":"#90ee90","lightpink":"#ffb6c1","lightsalmon":"#ffa07a","lightseagreen":"#20b2aa","lightskyblue":"#87cefa","lightslategray":"#778899","lightsteelblue":"#b0c4de",
    "lightyellow":"#ffffe0","lime":"#00ff00","limegreen":"#32cd32","linen":"#faf0e6",
    "magenta":"#ff00ff","maroon":"#800000","mediumaquamarine":"#66cdaa","mediumblue":"#0000cd","mediumorchid":"#ba55d3","mediumpurple":"#9370d8","mediumseagreen":"#3cb371","mediumslateblue":"#7b68ee",
    "mediumspringgreen":"#00fa9a","mediumturquoise":"#48d1cc","mediumvioletred":"#c71585","midnightblue":"#191970","mintcream":"#f5fffa","mistyrose":"#ffe4e1","moccasin":"#ffe4b5",
    "navajowhite":"#ffdead","navy":"#000080",
    "oldlace":"#fdf5e6","olive":"#808000","olivedrab":"#6b8e23","orange":"#ffa500","orangered":"#ff4500","orchid":"#da70d6",
    "palegoldenrod":"#eee8aa","palegreen":"#98fb98","paleturquoise":"#afeeee","palevioletred":"#d87093","papayawhip":"#ffefd5","peachpuff":"#ffdab9","peru":"#cd853f","pink":"#ffc0cb","plum":"#dda0dd","powderblue":"#b0e0e6","purple":"#800080",
    "rebeccapurple":"#663399","red":"#ff0000","rosybrown":"#bc8f8f","royalblue":"#4169e1",
    "saddlebrown":"#8b4513","salmon":"#fa8072","sandybrown":"#f4a460","seagreen":"#2e8b57","seashell":"#fff5ee","sienna":"#a0522d","silver":"#c0c0c0","skyblue":"#87ceeb","slateblue":"#6a5acd","slategray":"#708090","snow":"#fffafa","springgreen":"#00ff7f","steelblue":"#4682b4",
    "tan":"#d2b48c","teal":"#008080","thistle":"#d8bfd8","tomato":"#ff6347","turquoise":"#40e0d0",
    "violet":"#ee82ee",
    "wheat":"#f5deb3","white":"#ffffff","whitesmoke":"#f5f5f5",
    "yellow":"#ffff00","yellowgreen":"#9acd32"};

// create getter function for all named color
for (var key in colorNameToHex) {
    if (colorNameToHex.hasOwnProperty(key)) {
        var colorValue = hexToColor(colorNameToHex[key]);
        (function(_colValue) {

            Object.defineProperty (Color, key, {
                get: function () { 
                    return _colValue.clone();
                }
            });

        })(colorValue);
    }
}

// add transparent getter
Object.defineProperty (Color, 'transparent', {
    get: function () { 
        return new Color(0, 0, 0, 0);
    }
});

// add transparent white getter
Object.defineProperty (Color, 'transwhite', {
    get: function () { 
        return new Color(1, 1, 1, 0);
    }
});


/**
 * Convert Hex value to Color instance.
 * @param {String} hex Hex value to parse.
 */
function hexToColor(hex) 
{
    // expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, function(m, r, g, b) {
        return r + r + g + g + b + b;
    });
    
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    var components = result ? {
        r: parseInt(result[1], 16) / 255.0,
        g: parseInt(result[2], 16) / 255.0,
        b: parseInt(result[3], 16) / 255.0
    } : null;

    // create Color instance
    if (!components) { throw new PintarConsole.Error("Invalid hex value to parse!"); }
    return new Color(components.r, components.g, components.b, 1);
}


// export Color object
module.exports = Color;
},{}],38:[function(require,module,exports){
/**
 * A utility to hold gametime.
 * 
 * |-- copyright and license --|
 * @package    Shaku
 * @file       shaku\lib\utils\game_time.js
 * @author     Ronen Ness (ronenness@gmail.com | http://ronenness.com)
 * @copyright  (c) 2021 Ronen Ness
 * @license    MIT
 * |-- end copyright and license --|
 * 
 */
'use strict';

 
/**
 * Class to hold current game time (elapse and deltatime).
 */
class GameTime
{
    /**
     * create the gametime object with current time.
     * @param {GameTime} prevTime The gameTime from previous call, required to calculate delta time from last frame.
     */
    constructor(prevTime)
    {
        // get current timestamp
        this.timestamp = getAccurateTimestampMs() - _startTime;
        
        /**
         * Elapsed time details in milliseconds and seconds.
         */
        this.elapsedTime = {
            milliseconds: this.timestamp - _startGameTime,
            seconds: (this.timestamp - _startGameTime) / 1000.0
        };

        // calculate delta times
        if (prevTime) {

            /**
             * Delta time details in milliseconds and seconds.
             */
            this.deltaTime = {
                milliseconds: this.timestamp - prevTime.timestamp,
                seconds: (this.timestamp - prevTime.timestamp) / 1000.0,
            };
        }
        else {
            this.deltaTime = null;
        }

        /**
         * Delta time, in seconds, since last frame.
         */
        this.delta = this.deltaTime ? this.deltaTime.seconds : null;

        /**
         * Total time, in seconds, since Shaku was initialized.
         */
        this.elapsed = this.elapsedTime.seconds;

        // freeze object
        Object.freeze(this);
    }
}

// do we have the performance.now method?
const gotPerformance = (typeof performance !== 'undefined') && performance.now;

// get most accurate timestamp in milliseconds.
function getAccurateTimestampMs() {
    if (gotPerformance) {
        return performance.now();
    }
    return (new Date).getTime();
}

// start time (from the moment this file was first included).
const _startTime = getAccurateTimestampMs();

// actually start game time (from the moment the game main loop started).
var _startGameTime = getAccurateTimestampMs();

// reset the time that represent the start of the game main loop.
GameTime.resetGameStartTime = () => {
    _startGameTime = getAccurateTimestampMs();
}

// export the method to get raw timestamp in milliseconds.
GameTime.rawTimestamp = getAccurateTimestampMs;

// export the GameTime class.
module.exports = GameTime;
},{}],39:[function(require,module,exports){
/**
 * Include all util classes.
 * 
 * |-- copyright and license --|
 * @package    Shaku
 * @file       shaku\lib\utils\index.js
 * @author     Ronen Ness (ronenness@gmail.com | http://ronenness.com)
 * @copyright  (c) 2021 Ronen Ness
 * @license    MIT
 * |-- end copyright and license --|
 * 
 */
 'use strict';

 module.exports = {
    Vector2: require('./vector2'),
    Rectangle: require('./rectangle'),
    Circle: require('./circle'),
    Color: require('./color'),
    Animator: require('./animator'),
    GameTime: require('./game_time')
 };
},{"./animator":35,"./circle":36,"./color":37,"./game_time":38,"./rectangle":40,"./vector2":41}],40:[function(require,module,exports){
/**
 * Implement a simple 2d rectangle.
 * 
 * |-- copyright and license --|
 * @package    Shaku
 * @file       shaku\lib\utils\rectangle.js
 * @author     Ronen Ness (ronenness@gmail.com | http://ronenness.com)
 * @copyright  (c) 2021 Ronen Ness
 * @license    MIT
 * |-- end copyright and license --|
 * 
 */
 'use strict';

const Circle = require('./circle');
const Vector2 = require('./vector2');


/**
 * Implement a simple 2d Rectangle.
 */
class Rectangle
{
    /**
     * Create the Rect.
     * @param {Number} x Rect position X (top left corner).
     * @param {Number} y Rect position Y (top left corner).
     * @param {Number} width Rect width.
     * @param {Number} height Rect height.
     */
    constructor(x, y, width, height)
    {
        this.x = x || 0;
        this.y = y || 0;
        this.width = width;
        this.height = height;
    }

    /**
     * Set rectangle values.
     * @param {Number} x Rectangle x position.
     * @param {Number} y Rectangle y position.
     * @param {Number} width Rectangle width.
     * @param {Number} height Rectangle height.
     * @returns {Rectangle} this.
     */
    set(x, y, width, height)
    {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        return this;
    }

    /**
     * Get position as Vector2.
     * @returns {Vector2} Position vector.
     */
    getPosition()
    {
        return new Vector2(this.x, this.y);
    }
    
    /**
     * Get size as Vector2.
     * @returns {Vector2} Size vector.
     */
    getSize()
    {
        return new Vector2(this.width, this.height);
    }
	
	/**
     * Get center position.
     * @returns {Vector2} Position vector.
     */
    getCenter()
    {
        return new Vector2(Math.round(this.x + this.width / 2), Math.round(this.y + this.height / 2));
    }

    /**
     * Get left value.
     * @returns {Number} rectangle left.
     */
    get left()
    {
        return this.x;
    }

    /**
     * Get right value.
     * @returns {Number} rectangle right.
     */
    get right()
    {
        return this.x + this.width;
    }

    /**
     * Get top value.
     * @returns {Number} rectangle top.
     */
    get top()
    {
        return this.y;
    }

    /**
     * Get bottom value.
     * @returns {Number} rectangle bottom.
     */
    get bottom()
    {
        return this.y + this.height;
    }

    /**
     * Return a clone of this rectangle.
     * @returns {Rectangle} Cloned rectangle.
     */
    clone()
    {
        return new Rectangle(this.x, this.y, this.width, this.height);
    }

    /**
     * Get top-left corner.
     * @returns {Vector2} Corner position vector.
     */
    get topLeft()
    {
        return new Vector2(this.x, this.y);
    }

    /**
     * Get top-right corner.
     * @returns {Vector2} Corner position vector.
     */
    get topRight()
    {
        return new Vector2(this.x + this.width, this.y);
    }
        
    /**
     * Get bottom-left corner.
     * @returns {Vector2} Corner position vector.
     */
    get bottomLeft()
    {
        return new Vector2(this.x, this.y + this.height);
    }

    /**
     * Get bottom-right corner.
     * @returns {Vector2} Corner position vector.
     */
    get bottomRight()
    {
        return new Vector2(this.x + this.width, this.y + this.height);
    }

    /**
     * Convert to string.
     */
    string() 
    {
        return this.x + ',' + this.y + ',' + this.width + ',' + this.height;
    }

    /**
     * Check if this rectangle contains a Vector2.
     * @param {Vector2} p Point to check.
     * @returns {Boolean} if point is contained within the rectangle.
     */
    containsVector(p) 
    {
        return p.x >= this.x && p.x <= this.x + this.width && p.y >= this.y && p.y <= this.y + this.height;
    }

    /**
     * Check if this rectangle collides with another rectangle.
     * @param {Rectangle} other Rectangle to check collision with.
     * @return {Boolean} if rectangles collide.
     */
    collideRect(other)
    {
        let r1 = this;
        let r2 = other;
        return !(r2.left > r1.right ||
                r2.right < r1.left ||
                r2.top > r1.bottom ||
                r2.bottom < r1.top);
    }

    /**
     * Checks if this rectangle collides with a circle.
     * @param {Circle} circle Circle to check collision with.
     * @return {Boolean} if rectangle collides with circle.
     */
    collideCircle(circle) 
    {
        // get center and radius
        let center = circle.center;
        let radius = circle.radius;

        // first check if circle center is inside the rectangle - easy case
        let rect = this;
        if (rect.containsPoint(center)) {
            return true;
        }

        // get rectangle center
        let rectCenter = rect.getCenter();

        // create a list of lines to check (in the rectangle) based on circle position to rect center
        let lines = [];
        if (rectCenter.x > center.x) {
            lines.push([rect.topLeft, rect.bottomLeft]);
        } else {
            lines.push([rect.topRight, rect.bottomRight]);
        }
        if (rectCenter.y > center.y) {
            lines.push([rect.topLeft, rect.topRight]);
        } else {
            lines.push([rect.bottomLeft, rect.bottomRight]);
        }

        // now check intersection between circle and each of the rectangle lines
        for (let i = 0; i < lines.length; ++i) {
            let disToLine = Math._extended.pointLineDistance(center, lines[i][0], lines[i][1]);
            if (disToLine <= radius) {
                return true;
            }
        }

        // no collision..
        return false;
    }
    
    /**
     * Build and return a rectangle from points.
     * @param {Array<Vector2>} points Points to build rectangle from.
     * @returns {Rectangle} new rectangle from points.
     */
    static fromPoints(points)
    {
        let min_x = points[0].x;
        let min_y = points[0].y;
        let max_x = min_x;
        let max_y = min_y;

        for (let i = 1; i < points.length; ++i) {
            min_x = Math.min(min_x, points[i].x);
            min_y = Math.min(min_y, points[i].y);
            max_x = Math.max(max_x, points[i].x);
            max_y = Math.max(max_y, points[i].y);
        }

        return new Rectangle(min_x, min_y, max_x - min_x, max_y - min_y);
    }

    /**
     * Check if equal to another rectangle.
     * @param {Rectangle} other Other rectangle to compare to.
     */
    equals(other)
    {
        return other && this.x == other.x && this.y == other.y && this.width == other.width && this.height == other.height;
    }
    
    /**
     * Lerp between two rectangles.
     * @param {Vector2} p1 First rectangles.
     * @param {Vector2} p2 Second rectangles.
     * @param {Number} a Lerp factor (0.0 - 1.0).
     * @returns {Rectangle} result rectangle.
     */
     static lerp(p1, p2, a)
     {
         function lerpScalar(start, end, a)
         {
             return ((1-a) * start) + (a * end);
         }
         return new Rectangle(  lerpScalar(p1.x, p2.x, a), 
                                lerpScalar(p1.y, p2.y, a), 
                                lerpScalar(p1.width, p2.width, a), 
                                lerpScalar(p1.height, p2.height, a)
                            );
     }
}


// export the rectangle class
module.exports = Rectangle;
},{"./circle":36,"./vector2":41}],41:[function(require,module,exports){
/**
 * Implement a simple 2d vector.
 * 
 * |-- copyright and license --|
 * @package    Shaku
 * @file       shaku\lib\utils\vector2.js
 * @author     Ronen Ness (ronenness@gmail.com | http://ronenness.com)
 * @copyright  (c) 2021 Ronen Ness
 * @license    MIT
 * |-- end copyright and license --|
 * 
 */
'use strict';

/**
 * A simple Vector object for 2d positions.
 */
class Vector2
{
    /**
     * Create the Vector object.
     * @param {number} x Vector X.
     * @param {number} y Vector Y.
     */
    constructor(x = 0, y = 0)
    {
        this.x = x;
        this.y = y;
    }
    
    /**
     * Clone the vector.
     * @returns {Vector2} cloned vector.
     */
    clone()
    {
        return new Vector2(this.x, this.y);
    }
    
    /**
     * Set vector value.
     * @param {Number} x X component.
     * @param {Number} y Y component.
     * @returns {Vector2} this.
     */
    set(x, y)
    {
        this.x = x;
        this.y = y;
        return this;
    }

    /**
     * Copy values from other vector into self.
     * @returns {Vector2} this.
     */
    copy(other) 
    {
        this.x = other.x;
        this.y = other.y;
        return this;
    }
    
    /**
     * Return a new vector of this + other.
     * @param {Number|Vector2} Other Vector or number to add.
     * @returns {Vector2} result vector.
     */
    add(other) 
    {
        if (typeof other === 'number') {
            return new Vector2(this.x + other, this.y + other);
        }
        return new Vector2(this.x + other.x, this.y + other.y);
    }
    
    /**
     * Return a new vector of this - other.
     * @param {Number|Vector2} Other Vector or number to sub.
     * @returns {Vector2} result vector.
     */
    sub(other) 
    {
        if (typeof other === 'number') {
            return new Vector2(this.x - other, this.y - other);
        }
        return new Vector2(this.x - other.x, this.y - other.y);
    }
    
    /**
     * Return a new vector of this / other.
     * @param {Number|Vector2} Other Vector or number to divide.
     * @returns {Vector2} result vector.
     */
    div(other) 
    {
        if (typeof other === 'number') {
            return new Vector2(this.x / other, this.y / other);
        }
        return new Vector2(this.x / other.x, this.y / other.y);
    }
    
    /**
     * Return a new vector of this * other.
     * @param {Number|Vector2} Other Vector or number to multiply.
     * @returns {Vector2} result vector.
     */
    mul(other) 
    {
        if (typeof other === 'number') {
            return new Vector2(this.x * other, this.y * other);
        }
        return new Vector2(this.x * other.x, this.y * other.y);
    }
    
    /**
     * Return a round copy of this vector.
     * @returns {Vector2} result vector.
     */
    round() 
    {
        return new Vector2(Math.round(this.x), Math.round(this.y));
    }
    
    /**
     * Return a floored copy of this vector.
     * @returns {Vector2} result vector.
     */
    floor() 
    {
        return new Vector2(Math.floor(this.x), Math.floor(this.y));
    }
        
    /**
     * Return a ceiled copy of this vector.
     * @returns {Vector2} result vector.
     */
    ceil() 
    {
        return new Vector2(Math.ceil(this.x), Math.ceil(this.y));
    }
    
    /**
     * Return a normalized copy of this vector.
     * @returns {Vector2} result vector.
     */
    normalized()
    {
        if (this.x == 0 && this.y == 0) { return Vector2.zero(); }
        let mag = this.length;
        return new Vector2(this.x / mag, this.y / mag);
    }

    /**
     * Add other vector values to self.
     * @param {Number|Vector2} Other Vector or number to add.
     * @returns {Vector2} this.
     */
    addSelf(other) 
    {
        if (typeof other === 'number') {
            this.x += other;
            this.y += other;
        }
        else {
            this.x += other.x;
            this.y += other.y;
        }
        return this;
    }

    /**
     * Sub other vector values from self.
     * @param {Number|Vector2} Other Vector or number to substract.
     * @returns {Vector2} this.
     */
    subSelf(other) 
    {
        if (typeof other === 'number') {
            this.x -= other;
            this.y -= other;
        }
        else {
            this.x -= other.x;
            this.y -= other.y;
        }
        return this;
    }
    
    /**
     * Divide this vector by other vector values.
     * @param {Number|Vector2} Other Vector or number to divide by.
     * @returns {Vector2} this.
     */
    divSelf(other) 
    {
        if (typeof other === 'number') {
            this.x /= other;
            this.y /= other;
        }
        else {
            this.x /= other.x;
            this.y /= other.y;
        }
        return this;
    }

    /**
     * Multiply this vector by other vector values.
     * @param {Number|Vector2} Other Vector or number to multiply by.
     * @returns {Vector2} this.
     */
    mulSelf(other) 
    {
        if (typeof other === 'number') {
            this.x *= other;
            this.y *= other;
        }
        else {
            this.x *= other.x;
            this.y *= other.y;
        }
        return this;
    }
    
    /**
     * Round self.
     * @returns {Vector2} this.
     */
    roundSelf() 
    {
        this.x = Math.round(this.x);
        this.y = Math.round(this.y);
        return this;
    }
    
    /**
     * Floor self.
     * @returns {Vector2} this.
     */
    floorSelf() 
    {
        this.x = Math.floor(this.x);
        this.y = Math.floor(this.y);
        return this;
    }
     
    /**
     * Ceil self.
     * @returns {Vector2} this.
     */
    ceilSelf() 
    {
        this.x = Math.ceil(this.x);
        this.y = Math.ceil(this.y);
        return this;
    }

    /**
     * Return a normalized copy of this vector.
     * @returns {Vector2} this.
     */
    normalizeSelf()
    {
        if (this.x == 0 && this.y == 0) { return this; }
        let mag = this.length;
        this.x /= mag;
        this.y /= mag;
        return this;
    }
    
    /**
     * Return if vector equals another vector.
     * @param {Vector2} other Other vector to compare to.
     * @returns {Boolean} if vectors are equal.
     */
    equals(other)
    {
        return ((this === other) || (this.x === other.x && this.y === other.y));
    }

    /**
     * Return vector length (aka magnitude).
     * @returns {Number} Vector length.
     */
    get length()
    {
        return Math.sqrt((this.x * this.x) + (this.y * this.y));
    }

    /**
     * Return a copy of this vector multiplied by a factor.
     * @returns {Vector2} result vector.
     */
    scaled(fac) 
    {
        return new Vector2(this.x * fac, this.y * fac);
    }

    /**
     * Get vector (0,0).
     * @returns {Vector2} result vector.
     */
    static get zero()
    {
        return new Vector2();
    }

    /**
     * Get vector with 1,1 values.
     * @returns {Vector2} result vector.
     */
    static get one()
    {
        return new Vector2(1, 1);
    }

    /**
     * Get vector with 0.5,0.5 values.
     * @returns {Vector2} result vector.
     */
    static get half()
    {
        return new Vector2(0.5, 0.5);
    }

    /**
     * Get vector with -1,0 values.
     * @returns {Vector2} result vector.
     */
    static get left()
    {
        return new Vector2(-1, 0);
    }

    /**
     * Get vector with 1,0 values.
     * @returns {Vector2} result vector.
     */
    static get right()
    {
        return new Vector2(1, 0);
    }

    /**
     * Get vector with 0,-1 values.
     * @returns {Vector2} result vector.
     */
    static get up()
    {
        return new Vector2(0, -1);
    }

    /**
     * Get vector with 0,1 values.
     * @returns {Vector2} result vector.
     */
    static get down()
    {
        return new Vector2(0, 1);
    }

    /**
     * Get degrees between this vector and another vector.
     * @param {Vector2} other Other vector.
     * @returns {Number} Angle between vectors in degrees.
     */
    degreesTo(other) 
    {
    return Vector2.degreesBetween(this, other);
    };

    /**
     * Get radians between this vector and another vector.
     * @param {Vector2} other Other vector.
     * @returns {Number} Angle between vectors in radians.
     */
    radiansTo(other) 
    {
        return Vector2.radiansBetween(this, other);
    };
    
    /**
     * Calculate distance between this vector and another vectors.
     * @param {Vector2} other Other vector.
     * @returns {Number} Distance between vectors.
     */
    distanceTo(other)
    {
    return Vector2.distance(this, other);
    }
    
    /**
     * Get vector from degrees.
     * @param {Number} degrees Angle to create vector from (0 = vector pointing right).
     * @returns {Vector2} result vector.
     */
    static fromDegree(degrees)
    {
        let rads = degrees * (Math.PI / 180);
        return new Vector2(Math.cos(rads), Math.sin(rads));
    }

    /**
     * Get vector from radians.
     * @param {Number} radians Angle to create vector from (0 = vector pointing right).
     * @returns {Vector2} result vector.
     */
    static fromRadians(radians)
    {
        return new Vector2(Math.cos(radians), Math.sin(radians));
    }
    
    /**
     * Lerp between two vectors.
     * @param {Vector2} p1 First vector.
     * @param {Vector2} p2 Second vector.
     * @param {Number} a Lerp factor (0.0 - 1.0).
     * @returns {Vector2} result vector.
     */
    static lerp(p1, p2, a)
    {
        function lerpScalar(start, end, a)
        {
            return ((1-a) * start) + (a * end);
        }
        return new Vector2(lerpScalar(p1.x, p2.x, a), lerpScalar(p1.y, p2.y, a));
    }

    /**
     * Get degrees between two vectors.
     * @param {Vector2} p1 First vector.
     * @param {Vector2} p2 Second vector.
     * @returns {Number} Angle between vectors in degrees.
     */
    static degreesBetween(P1, P2) 
    {
        let deltaY = P2.y - P1.y,
        deltaX = P2.x - P1.x;
        return Math.atan2(deltaY, deltaX) * (180 / Math.PI);
    };

    /**
     * Get radians between two vectors.
     * @param {Vector2} p1 First vector.
     * @param {Vector2} p2 Second vector.
     * @returns {Number} Angle between vectors in radians.
     */
    static radiansBetween(P1, P2) 
    {
        let deltaY = P2.y - P1.y,
        deltaX = P2.x - P1.x;
        return Math.atan2(deltaY, deltaX);
    };
    
    /**
     * Calculate distance between two vectors.
     * @param {Vector2} p1 First vector.
     * @param {Vector2} p2 Second vector.
     * @returns {Number} Distance between vectors.
     */
    static distance(p1, p2)
    {
        let a = p1.x - p2.x;
        let b = p1.y - p2.y;
        return Math.sqrt(a*a + b*b);
    }

    /**
     * Return cross product between two vectors.
     * @param {Vector2} p1 First vector.
     * @param {Vector2} p2 Second vector.
     * @returns {Number} Cross between vectors.
     */
    static cross(p1, p2)
    {
        return p1.x * p2.y - p1.y * p2.x;
    }
     
    /**
     * Return dot product between two vectors.
     * @param {Vector2} p1 First vector.
     * @param {Vector2} p2 Second vector.
     * @returns {Number} Dot between vectors.
     */
    static dot(p1, p2)
    {
        return p1.x * p2.x + p1.y * p2.y;
    }

    /**
     * Convert to string.
     */
    string()
    {
        return this.x + ',' + this.y;
    }

    /**
     * Parse and return a vector object from string in the form of "x,y".
     * @param {String} str String to parse.
     * @returns {Vector2} Parsed vector.
     */
    static parse(str)
    {
        let parts = str.split(',');
        return new Vector2(parseFloat(parts[0].trim()), parseFloat(parts[1].trim()));
    }
}

// export vector object
module.exports = Vector2;
},{}]},{},[24])(24)
});
