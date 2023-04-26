/**
 * Implement the gfx sprite batch renderer.
 * 
 * |-- copyright and license --|
 * @module     Shaku
 * @file       shaku\src\gfx\draw_batches\sprite_batch_3d.js
 * @author     Ronen Ness (ronenness@gmail.com | http://ronenness.com)
 * @copyright  (c) 2021 Ronen Ness
 * @license    MIT
 * |-- end copyright and license --|
 * 
 */
'use strict';
const Vector3 = require('../../utils/vector3');
const Matrix = require('../matrix');
const DrawBatch = require('./draw_batch');
const SpriteBatch = require('./sprite_batch');
const _logger = require('../../logger.js').getLogger('gfx-sprite-batch');


/**
 * 3D Sprites batch renderer. 
 * Responsible to drawing 3D quads with textures on them.
 */
class SpriteBatch3D extends SpriteBatch
{
    /**
     * Create the 3d sprites batch.
     * @param {Number=} batchSpritesCount Internal buffers size, in sprites count (sprite = 4 vertices). Bigger value = faster rendering but more RAM.
     * @param {Boolean=} normalizeUvs If true (default) will normalize UV values from 0 to 1.
     */
    constructor(batchSpritesCount, normalizeUvs)
    {
        super(batchSpritesCount, normalizeUvs, true);
        this.setViewLookat();
        this.setPerspectiveCamera();
    }

    /**
     * Set to default view matrix.
     * @param {Vector3=} eyePosition Camera source position.
     * @param {Vector3=} lookAt Camera look-at target.
     */
    setViewLookat(eyePosition, lookAt)
    {
        this.__view = Matrix.lookAt(eyePosition || new Vector3(0, 0, -500), lookAt || new Vector3(0, 0, 0), Vector3.upReadonly);
    }

    /**
     * Set perspective camera.
     * @param {Number=} fieldOfView Camera field of view.
     * @param {Number=} aspectRatio Camera aspect ratio
     * @param {Number=} zNear Z near plane.
     * @param {Number=} zFar Z far plane.
     */
    setPerspectiveCamera(fieldOfView, aspectRatio, zNear, zFar)
    {
        let camera = this.#_gfx.createCamera();
        fieldOfView = fieldOfView || ((45 * Math.PI) / 180);
        aspectRatio = aspectRatio || (this.#_gfx.getRenderingSize().x / this.#_gfx.getRenderingSize().y);
        zNear = zNear || 0.1;
        zFar = zFar || 10000.0;
        camera.perspective(fieldOfView, aspectRatio, zNear, zFar);
        this.__camera = camera;
    }

    /**
     * Get the gfx manager.
     * @private
     */
    get #_gfx()
    {
        return DrawBatch._gfx;
    }

    /**
     * Get the web gl instance.
     * @private
     */
    get #_gl()
    {
        return DrawBatch._gfx._internal.gl;
    }

    /**
     * @inheritdoc
     */
    get supportVertexColor()
    {
        return true;
    }

    /**
     * @inheritdoc
     */
    get defaultEffect()
    {
        return this.#_gfx.builtinEffects.Sprites3d;
    }

    /**
     * Set the camera for this batch.
     * @param {Matrix} camera Camera object to apply when drawing, or null if you want to set the camera manually.
     */
    setCamera(camera)
    {
        this.__camera = camera;
    }

    /**
     * Set the view matrix for this batch.
     * @param {Matrix} view View matrix, or null if you want to set the view matrix manually.
     */
    setView(view)
    {
        this.__view = view;
    }

    /**
     * @inheritdoc
     * @private
     */
    _onSetEffect(effect, texture)
    {
        if (this.__view) { effect.setViewMatrix(this.__view); }
        if (this.__camera) { this.#_gfx.applyCamera(this.__camera); }
    }
}


// export the sprite batch class
module.exports = SpriteBatch3D;