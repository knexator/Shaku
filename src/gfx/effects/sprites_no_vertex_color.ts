import { Effect } from "./effect";
import fragmentShader from "./shaders/sprites_no_vertex_color.frag";
import vertexShader from "./shaders/sprites_no_vertex_color.vert";

/**
 * Default basic effect to draw 2d sprites without vertex color.
 */
export class SpritesEffectNoVertexColor extends Effect {
	/**
	 * @inheritdoc
	 */
	public override getVertexCode() {
		return vertexShader;
	}

	/**
	 * @inheritdoc
	 */
	public override getFragmentCode() {
		return fragmentShader;
	}

	/**
	 * @inheritdoc
	 */
	public override getUniformTypes() {
		return {
			[Effect.UniformBinds.MainTexture]: { type: Effect.UniformTypes.TEXTURE, bind: Effect.UniformBinds.MainTexture },
			[Effect.UniformBinds.Projection]: { type: Effect.UniformTypes.MATRIX, bind: Effect.UniformBinds.Projection },
			[Effect.UniformBinds.World]: { type: Effect.UniformTypes.MATRIX, bind: Effect.UniformBinds.World },
			[Effect.UniformBinds.View]: { type: Effect.UniformTypes.MATRIX, bind: Effect.UniformBinds.View },
		};
	}

	/**
	 * @inheritdoc
	 */
	public override getAttributeTypes() {
		return {
			[Effect.AttributeBinds.Position]: { size: 3, type: Effect.AttributeTypes.Float, normalize: false, bind: Effect.AttributeBinds.Position },
			[Effect.AttributeBinds.TextureCoords]: { size: 2, type: Effect.AttributeTypes.Float, normalize: false, bind: Effect.AttributeBinds.TextureCoords },
		};
	}
}
