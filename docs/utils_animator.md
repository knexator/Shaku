![Shaku JS](resources/logo-sm.png)

[Back To Table of Content](index.md)

# Animator

## Classes

<dl>
<dt><a href="#Animator">Animator</a></dt>
<dd><p>Implement an animator object that change values over time using Linear Interpolation.
Usage example:
(new Animator(sprite)).from({&#39;position.x&#39;: 0}).to({&#39;position.x&#39;: 100}).duration(1).play();</p>
</dd>
</dl>

## Typedefs

<dl>
<dt><a href="#easingFunction">easingFunction</a> ⇒ <code>number</code></dt>
<dd></dd>
</dl>

<a name="Animator"></a>

## Animator
Implement an animator object that change values over time using Linear Interpolation.
Usage example:
(new Animator(sprite)).from({'position.x': 0}).to({'position.x': 100}).duration(1).play();

**Kind**: global class  

* [Animator](#Animator)
    * [new Animator(target)](#new_Animator_new)
    * [.speedFactor](#Animator+speedFactor)
    * [.ended](#Animator+ended) ⇒ <code>Boolean</code>
    * [.update(delta)](#Animator+update)
    * [.onUpdate(callback)](#Animator+onUpdate) ⇒ [<code>Animator</code>](#Animator)
    * [.then(callback)](#Animator+then) ⇒ [<code>Animator</code>](#Animator)
    * [.delay(value)](#Animator+delay)
    * [.easing(easing)](#Animator+easing)
    * [.smoothDamp(enable)](#Animator+smoothDamp) ⇒ [<code>Animator</code>](#Animator)
    * [.repeats(enable, reverseAnimation)](#Animator+repeats) ⇒ [<code>Animator</code>](#Animator)
    * [.from(values)](#Animator+from) ⇒ [<code>Animator</code>](#Animator)
    * [.to(values)](#Animator+to) ⇒ [<code>Animator</code>](#Animator)
    * [.flipFromAndTo()](#Animator+flipFromAndTo)
    * [.duration(seconds)](#Animator+duration) ⇒ [<code>Animator</code>](#Animator)
    * [.reset()](#Animator+reset) ⇒ [<code>Animator</code>](#Animator)
    * [.play()](#Animator+play) ⇒ [<code>Animator</code>](#Animator)

<a name="new_Animator_new"></a>

### new Animator(target)
Create the animator.


| Param | Type | Description |
| --- | --- | --- |
| target | <code>\*</code> | Any object you want to animate. |

<a name="Animator+speedFactor"></a>

### animator.speedFactor
Speed factor to multiply with delta every time this animator updates.

**Kind**: instance property of [<code>Animator</code>](#Animator)  
<a name="Animator+ended"></a>

### animator.ended ⇒ <code>Boolean</code>
Get if this animator finished.

**Kind**: instance property of [<code>Animator</code>](#Animator)  
**Returns**: <code>Boolean</code> - True if animator finished.  
<a name="Animator+update"></a>

### animator.update(delta)
Update this animator with a given delta time.

**Kind**: instance method of [<code>Animator</code>](#Animator)  

| Param | Type | Description |
| --- | --- | --- |
| delta | <code>Number</code> | Delta time to progress this animator by. |

<a name="Animator+onUpdate"></a>

### animator.onUpdate(callback) ⇒ [<code>Animator</code>](#Animator)
Set a method to run every frame.

**Kind**: instance method of [<code>Animator</code>](#Animator)  
**Returns**: [<code>Animator</code>](#Animator) - this.  

| Param | Type | Description |
| --- | --- | --- |
| callback | <code>function</code> | Callback to invoke every frame. |

<a name="Animator+then"></a>

### animator.then(callback) ⇒ [<code>Animator</code>](#Animator)
Set a method to run when animation ends.

**Kind**: instance method of [<code>Animator</code>](#Animator)  
**Returns**: [<code>Animator</code>](#Animator) - this.  

| Param | Type | Description |
| --- | --- | --- |
| callback | <code>function</code> | Callback to invoke when done. |

<a name="Animator+delay"></a>

### animator.delay(value)
Add an initial delay.

**Kind**: instance method of [<code>Animator</code>](#Animator)  

| Param | Type | Description |
| --- | --- | --- |
| value | <code>Number</code> | Seconds to delay this animator by. |

<a name="Animator+easing"></a>

### animator.easing(easing)
Set an arbitrary easing function.

**Kind**: instance method of [<code>Animator</code>](#Animator)  

| Param | Type | Description |
| --- | --- | --- |
| easing | [<code>easingFunction</code>](#easingFunction) | the easing function to use. |

<a name="Animator+smoothDamp"></a>

### animator.smoothDamp(enable) ⇒ [<code>Animator</code>](#Animator)
Set smooth damp.
If true, lerping will go slower as the animation reach its ending.

**Kind**: instance method of [<code>Animator</code>](#Animator)  
**Returns**: [<code>Animator</code>](#Animator) - this.  

| Param | Type | Description |
| --- | --- | --- |
| enable | <code>Boolean</code> | set smooth damp mode. |

<a name="Animator+repeats"></a>

### animator.repeats(enable, reverseAnimation) ⇒ [<code>Animator</code>](#Animator)
Set if the animator should repeat itself.

**Kind**: instance method of [<code>Animator</code>](#Animator)  
**Returns**: [<code>Animator</code>](#Animator) - this.  

| Param | Type | Description |
| --- | --- | --- |
| enable | <code>Boolean</code> \| <code>Number</code> | false to disable repeating, true for endless repeats, or a number for limited number of repeats. |
| reverseAnimation | <code>Boolean</code> | if true, it will reverse animation to repeat it instead of just "jumping" back to starting state. |

<a name="Animator+from"></a>

### animator.from(values) ⇒ [<code>Animator</code>](#Animator)
Set 'from' values.
You don't have to provide 'from' values, when a value is not set the animator will just take whatever was set in target when first update is called.

**Kind**: instance method of [<code>Animator</code>](#Animator)  
**Returns**: [<code>Animator</code>](#Animator) - this.  

| Param | Type | Description |
| --- | --- | --- |
| values | <code>\*</code> | Values to set as 'from' values.  Key = property name in target (can contain dots for nested), value = value to start animation from. |

<a name="Animator+to"></a>

### animator.to(values) ⇒ [<code>Animator</code>](#Animator)
Set 'to' values, ie the result when animation ends.

**Kind**: instance method of [<code>Animator</code>](#Animator)  
**Returns**: [<code>Animator</code>](#Animator) - this.  

| Param | Type | Description |
| --- | --- | --- |
| values | <code>\*</code> | Values to set as 'to' values.  Key = property name in target (can contain dots for nested), value = value to start animation from. |

<a name="Animator+flipFromAndTo"></a>

### animator.flipFromAndTo()
Flip between the 'from' and the 'to' states.

**Kind**: instance method of [<code>Animator</code>](#Animator)  
<a name="Animator+duration"></a>

### animator.duration(seconds) ⇒ [<code>Animator</code>](#Animator)
Make this Animator update automatically with the gameTime delta time.
Note: this will change the speedFactor property.

**Kind**: instance method of [<code>Animator</code>](#Animator)  
**Returns**: [<code>Animator</code>](#Animator) - this.  

| Param | Type | Description |
| --- | --- | --- |
| seconds | <code>Number</code> | Animator duration time in seconds. |

<a name="Animator+reset"></a>

### animator.reset() ⇒ [<code>Animator</code>](#Animator)
Reset animator progress.

**Kind**: instance method of [<code>Animator</code>](#Animator)  
**Returns**: [<code>Animator</code>](#Animator) - this.  
<a name="Animator+play"></a>

### animator.play() ⇒ [<code>Animator</code>](#Animator)
Make this Animator update automatically with the gameTime delta time, until its done.

**Kind**: instance method of [<code>Animator</code>](#Animator)  
**Returns**: [<code>Animator</code>](#Animator) - this.  
<a name="easingFunction"></a>

## easingFunction ⇒ <code>number</code>
**Kind**: global typedef  
**Returns**: <code>number</code> - New time in 0-1  

| Param | Type | Description |
| --- | --- | --- |
| t | <code>number</code> | Time in 0-1 |

