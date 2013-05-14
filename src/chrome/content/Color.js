"use strict";
// vim: ts=4 sw=4 sts=4
/**
 * Author: Lachlan Hunt
 * Date: 2005-11-24
 * Version: 1.0-cgh1
 * Contributor: Christian G. Höltje
 *
 * Licence: Public Domain
 * Attribution is considered ethical, but not required.
 *
 * Usage:
 *   Color(255, 255, 255);
 *   Color(255, 255, 255, 1.0);
 *   Color("#FFF");
 *   Color("#FFFFFF");
 *   Color("rgb(255, 255, 255)");
 *   Color("rgba(255, 255, 255, 1.0)");
 *   Color("white"); - CSS 2.1 Color keywords only
 */
var Color = function () {
    var keyword,
    func,
    clamp,
    alphaBlend,
    value,
    components,
    pattern,
    key,
    base,
    m,
    r,
    g,
    b,
    a;

    // CSS 2.1 Colour Keywords
    keyword = {
        maroon   : "#800000",
        red      : "#ff0000",
        orange   : "#ffA500",
        yellow   : "#ffff00",
        olive    : "#808000",
        purple   : "#800080",
        fuchsia  : "#ff00ff",
        white    : "#ffffff",
        lime     : "#00ff00",
        green    : "#008000",
        navy     : "#000080",
        blue     : "#0000ff",
        aqua     : "#00ffff",
        teal     : "#008080",
        black    : "#000000",
        silver   : "#c0c0c0",
        gray     : "#808080"
    };

    // CSS Functional Notations and Hex Patterns
    func = {
        rgb   : /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\);?$/,
        "rgb%"  : /^rgb\(\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*\);?$/,
        rgba  : /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*((?:\d+(?:\.\d+)?)|(?:\.\d+))\s*\);?$/,
        "rgba%" : /^rgba\(\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*,\s*((?:\d+(?:\.\d+)?)|(?:\.\d+))\s*\);?$/,
        hex3  : /^#([0-9A-Fa-f])([0-9A-Fa-f])([0-9A-Fa-f]);?$/,
        hex6  : /^#([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2});?$/
    };

    /**
     * Clamp the value between the low value and the high value
     * @private
     */
    clamp = function (value, low, high) {
        if (value < low) {
            value = low;
        }
        else if (value > high) {
            value = high;
        }
        return value;
    };

    /**
     * @private
     */
    alphaBlend = function (forground, background, alpha) {
        return Math.round(background * (1.0 - alpha) + forground * (alpha));
    };

    /*
     * Return the colour in hexadecimal notation: #RRGGBB. e.g. #FF9933
     * @param bg - Optional parameter used for calculating the colour if an alpha value less than 1.0 has been specified.
     *             If not specified, the alpha value will be ignored.
     */
    this.hex = function (bg) {
        var r,
        g,
        b,
        strHexR,
        strHexG,
        strHexB;
        if (bg) {
            r = alphaBlend(this.red, bg.red, this.alpha);
            g = alphaBlend(this.green, bg.green, this.alpha);
            b = alphaBlend(this.blue, bg.blue, this.alpha);
        } else {
            r = this.red;
            g = this.green;
            b = this.blue;
        }

        strHexR = r.toString(16).toUpperCase();
        strHexG = g.toString(16).toUpperCase();
        strHexB = b.toString(16).toUpperCase();

        if (strHexR.length < 2) {
            strHexR = "0" + strHexR;
        }
        if (strHexG.length < 2) {
            strHexG = "0" + strHexG;
        }
        if (strHexB.length < 2) {
            strHexB = "0" + strHexB;
        }

        return "#" + strHexR + strHexG + strHexB;
    };

    /**
     * Return the colour in CSS rgb() functional notation, using integers 0-255: rgb(255, 255 255);
     * @param bg - Optional parameter used for calculating the colour if an alpha value less than 1.0 has been specified.
     *             If not specified, the alpha value will be ignored.
     */
    this.rgb = function (bg) {
        var r,
        g,
        b;
        if (bg) {
            r = alphaBlend(this.red, bg.red, this.alpha);
            g = alphaBlend(this.green, bg.green, this.alpha);
            b = alphaBlend(this.blue, bg.blue, this.alpha);
        } else {
            r = this.red;
            g = this.green;
            b = this.blue;
        }

        return "rgb(" + r + ", " + g + ", " + b + ")";
    };

    /**
     * Return the colour in CSS rgba() functional notation, using integers 0-255 for color components: rgb(255, 255 255, 1.0);
     * @param bg - Optional parameter used for calculating the colour if an alpha value less than 1.0 has been specified.
     *             If not specified, and there is an alpha value, black will be used as the background colour.
     */
    this.rgba = function () {
        return "rgba(" + this.red + ", " + this.green + ", " + this.blue + ", " + this.alpha + ")";
    };

    /**
     * Returns a Color object with the values inverted. Ignores alpha.
     */
    this.invert = function () {
        return new Color("rgb(" +
                         (255 - this.red) + ", " +
                         (255 - this.green) + ", " +
                         (255 - this.blue) + ")");
    };

    /**
     * Blend this colour with the colour specified and return a pallet with all the steps in between.
     * @param color - The colour to blend with
     * @param steps - The number of steps to take to reach the color.
     */
    this.blend = function (color, steps) {
        var pallet = [],
        r,
        g,
        b,
        i,
        step = {
            red   : (alphaBlend(color.red, this.red, color.alpha) - this.red) / steps,
            green : (alphaBlend(color.green, this.green, color.alpha) - this.green) / steps,
            blue  : (alphaBlend(color.blue,  this.blue,  color.alpha) - this.blue) / steps
        };
        for (i = 0; i < steps + 1; i++) {
            r = Math.round(this.red   + (step.red * i));
            g = Math.round(this.green + (step.green * i));
            b = Math.round(this.blue  + (step.blue * i));
            pallet.push(new Color(r, g, b));
        }
        return pallet;
    };

    /**
     * Constructor function
     */
    this.toString = this.hex;

    if (arguments.length >= 3) {
        /* r, g, b or r, g, b, a */
        r = arguments[0];
        g = arguments[1];
        b = arguments[2];
        a = arguments[3];

        this.red   = (!isNaN(r)) ? clamp(r, 0, 255) : 0;
        this.green = (!isNaN(g)) ? clamp(g, 0, 255) : 0;
        this.blue  = (!isNaN(b)) ? clamp(b, 0, 255) : 0;
        this.alpha = (!isNaN(a)) ? clamp(a, 0.0, 1.0) : 1.0;
    } else if (arguments.length == 1) {
        /* CSS Colour keyword or value */
        value = keyword[arguments[0]] ? keyword[arguments[0]] : arguments[0];

        for (key in func) {
            if (func[key].test(value)) {
                pattern = key;
            }
        }

        components = value.match(func[pattern]);
        base = 10;
        m = 1; // Multiplier for percentage values

        switch (pattern) {
            case "rgb%":
                case "rgba%":
                m = 2.55;
            base = 10;
            break;
            case "rgb":
                case "rgba":
                base = 10;
            break;
            case "hex3":
                components[1] = components[1] + "" + components[1];
            components[2] = components[2] + "" + components[2];
            components[3] = components[3] + "" + components[3];
            base = 16;
            break;
            case "hex6":
                base = 16;
            break;
            default:
                components = [0, "255", "255", "255", "1.0"];
        }

        this.red   = clamp(Math.round(parseInt(components[1], base) * m), 0, 255);
        this.green = clamp(Math.round(parseInt(components[2], base) * m), 0, 255);
        this.blue  = clamp(Math.round(parseInt(components[3], base) * m), 0, 255);

        if (typeof(components[4]) === 'undefined' || isNaN(components[4])) {
            this.alpha = 1;
        } else {
            this.alpha = clamp(parseFloat("0" + components[4]), 0.0, 1.0);
        }
    }
};

