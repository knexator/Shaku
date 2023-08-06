import { TextureAsset, TextureAtlasAsset } from ".";
import { Rectangle } from "../utils";
import { TextureAssetBase } from "./texture_asset_base";

/**
 * A texture that is part of a texture atlas.
 * Stores a texture that was generated by the texture atlas + the source rectangle in texture for this segment.
 */
export class TextureInAtlasAsset extends TextureAssetBase {
	private _texture: TextureAsset;
	private _sourceRect: Rectangle;
	private _atlas: TextureAtlasAsset;
	private _sourceRectNormalized: Rectangle;

	/**
	 * @inheritdoc
	 */
	public constructor(url: string, texture: TextureAsset, sourceRect: Rectangle, atlas: TextureAtlasAsset) {
		super(url);
		this._texture = texture;
		this._sourceRect = sourceRect;
		this._atlas = atlas;
	}

	/**
	 * Return the source rectangle in texture atlas.
	 * @returns Source rectangle.
	 */
	public get sourceRectangle(): Rectangle {
		return this._sourceRect;
	}

	/**
	 * Return the source rectangle in texture atlas, in normalized 0.0-1.0 values.
	 * @returns Source rectangle.
	 */
	public get sourceRectangleNormalized(): Rectangle {
		if(!this._sourceRectNormalized) {
			this._sourceRectNormalized = new Rectangle(
				this._sourceRect.x / this.width,
				this._sourceRect.y / this.height,
				this._sourceRect.width / this.width,
				this._sourceRect.height / this.height
			);
		}
		return this._sourceRectNormalized;
	}

	/**
	 * Return the texture asset of this atlas texture.
	 * @returns Texture asset.
	 */
	public get texture(): TextureAsset {
		return this._texture;
	}

	/**
	 * Return the texture atlas class.
	 * @returns Parent atlas.
	 */
	public get atlas(): TextureAtlasAsset {
		return this._atlas;
	}

	/**
	 * @inheritdoc
	 */
	public get image(): unknown {
		return this.texture.image;
	}

	/**
	 * @inheritdoc
	 */
	public get width(): number {
		return this.texture.width;
	}

	/**
	 * @inheritdoc
	 */
	public get height(): number {
		return this.texture.height;
	}

	/**
	 * @inheritdoc
	 */
	private get _glTexture(): WebGLTexture {
		return this.texture._glTexture;
	}

	/**
	 * @inheritdoc
	 */
	public get valid(): boolean {
		return Boolean(this.texture.valid);
	}

	/**
	 * @inheritdoc
	 */
	public destroy(): void {
	}
}
