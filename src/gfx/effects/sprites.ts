import Effect from "./effect";

// vertex shader code
const vertexShader = `
attribute vec3 position;
attribute vec2 uv;
attribute vec4 color;

uniform mat4 projection;
uniform mat4 world;

varying vec2 v_texCoord;
varying vec4 v_color;

void main(void) {
    gl_Position = projection * world * vec4(position, 1.0);
    gl_PointSize = 1.0;
    v_texCoord = uv;
    v_color = color;
}
    `;

// fragment shader code
const fragmentShader = `
#ifdef GL_ES
    precision highp float;
#endif

uniform sampler2D mainTexture;

varying vec2 v_texCoord;
varying vec4 v_color;

void main(void) {
    gl_FragColor = texture2D(mainTexture, v_texCoord) * v_color;
    gl_FragColor.rgb *= gl_FragColor.a;
}
    `;

/**
 * Default basic effect to draw 2d sprites.
 */
class SpritesEffect extends Effect {
	/** @inheritdoc */
	get vertexCode() {
		return vertexShader;
	}

	/** @inheritdoc */
	get fragmentCode() {
		return fragmentShader;
	}

	/** @inheritdoc */
	get uniformTypes() {
		return {
			[Effect.UniformBinds.MainTexture]: { type: Effect.UniformTypes.Texture, bind: Effect.UniformBinds.MainTexture },
			[Effect.UniformBinds.Projection]: { type: Effect.UniformTypes.Matrix, bind: Effect.UniformBinds.Projection },
			[Effect.UniformBinds.World]: { type: Effect.UniformTypes.Matrix, bind: Effect.UniformBinds.World },
			[Effect.UniformBinds.View]: { type: Effect.UniformTypes.Matrix, bind: Effect.UniformBinds.View }
		};
	}

	/** @inheritdoc */
	get attributeTypes() {
		return {
			[Effect.AttributeBinds.Position]: { size: 3, type: Effect.AttributeTypes.Float, normalize: false, bind: Effect.AttributeBinds.Position },
			[Effect.AttributeBinds.TextureCoords]: { size: 2, type: Effect.AttributeTypes.Float, normalize: false, bind: Effect.AttributeBinds.TextureCoords },
			[Effect.AttributeBinds.Colors]: { size: 4, type: Effect.AttributeTypes.Float, normalize: false, bind: Effect.AttributeBinds.Colors },
		};
	}
}

// export the basic shader
export default SpritesEffect;
