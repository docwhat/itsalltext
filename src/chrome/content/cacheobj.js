/*extern ItsAllText, Components */
/*jslint undef: true, nomen: true, evil: false, browser: true, white: true */
/*
 *  It's All Text! - Easy external editing of web forms.
 *
 *  Copyright (C) 2006-2007 Christian Höltje
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * A Cache object is used to manage the node and the file behind it.
 * @constructor
 * @param {Object} node A DOM Node to watch.
 */
function CacheObj(node) {
    var that = this,
        doc = node.ownerDocument,
        host,
        hash,
        extension;

    /* Gumdrop Image URL */
    that.gumdrop_url    = 'chrome://itsalltext/locale/gumdrop.png';
    /* Gumdrop Image Width */
    that.gumdrop_width  = ItsAllText.localeString('gumdrop.width');
    /* Gumdrop Image Height */
    that.gumdrop_height = ItsAllText.localeString('gumdrop.height');

    that.timestamp = 0;
    that.size = 0;
    that.node = node;
    that.button = null;
    that.initial_background = '';
    that.private_is_watching = false;
    that.button_fade_timer = null;
    that.is_focused = false;

    that.node_id = that.getNodeIdentifier(node);

    /* This is a unique identifier for use on the web page to prevent the
     * web page from knowing what it's connected to.
     * @type String
     */
    that.uid = that.hashString([ doc.location.toString(),
                                 Math.random(),
                                 that.node_id ].join(':'));
    // @todo [security] Add a serial to the uid hash.

    node.setAttribute(ItsAllText.MYSTRING + '_UID', that.uid);
    ItsAllText.tracker[that.uid] = that;

    /* Figure out where we will store the file.  While the filename can
     * change, the directory that the file is stored in should not!
     */
    host = window.escape(doc.location.hostname);
    hash = that.hashString([ doc.location.protocol,
                             doc.location.port,
                             doc.location.search,
                             doc.location.pathname,
                             that.node_id].join(':'));
    that.base_filename = [host, hash.slice(0, 10)].join('.');
    /* The current extension.
     * @type String
     */
    that.extension = null;

    /* Stores an nsILocalFile pointing to the current filename.
     * @type nsILocalFile
     */
    that.file = null;

    /* The number of edits done on this object.
     * @type number
     */
    that.edit_count = 0;

    /* Set the default extension and create the nsIFile object. */
    extension = node.getAttribute('itsalltext-extension');
    if (typeof(extension) != 'string' || !extension.match(/^[.a-z0-9]+$/i)) {
        extension = ItsAllText.getExtensions()[0];
    }
    that.setExtension(extension);

    that.initFromExistingFile();

    /**
     * A callback for when the textarea/textbox or button has
     * the mouse waved over it.
     * @param {Event} event The event object.
     */
    that.mouseover = function (event) {
        if (event.type === 'focus') {
            that.is_focused = true;
        }
        if (that.button_fade_timer) {
            clearTimeout(that.button_fade_timer);
        }
        var style = that.button?that.button.style:null;
        if (style) {
            style.setProperty('opacity', '0.7',   'important');
            style.setProperty('display', 'block', 'important');
        }
        ItsAllText.refreshTextarea(that.node);
    };

    /**
     * A callback for when the textarea/textbox or button has
     * the mouse waved over it and the moved off.
     * @param {Event} event The event object.
     */
    that.mouseout = function (event) {
        if (that.button_fade_timer) {
            clearTimeout(that.button_fade_timer);
        }
        if (that.is_focused && event.type !== 'blur') {
            /* we're focused, don't fade until we're blurred. */
            return;
        }
        that.is_focused = false;

        var style = that.button?that.button.style:null,
            f,
            cur  = 0.7,
            dest = 0,
            fps  = 12,
            num_frames = (ItsAllText.preferences.fade_time * fps),
            increment = (cur - dest) / num_frames,
            wait = (1 / fps) / 1000;
        if (style) {
            f = function () {
                cur -= increment;
                if (cur > dest) {
                    style.setProperty('opacity', cur, 'important');
                    that.button_fade_timer = setTimeout(f, wait);
                } else {
                    style.setProperty('display', 'none', 'important');
                }
            };
            f();
        }
    };
}

/**
 * Destroys the object, unallocating as much as possible to prevent leaks.
 */
CacheObj.prototype.destroy = function () {
    ItsAllText.debug('destroying', this.node_id, this.uid);
    var node = this.node,
        doc  = this.node.ownerDocument,
        html = doc.getElementsByTagName('html')[0];

    node.removeAttribute(ItsAllText.MYSTRING + '_UID');
    html.removeAttribute(ItsAllText.MYSTRING + '_id_serial');

    delete this.node;
    delete this.button;
    delete this.file;
    this.file = this.node = this.button = null;
};

/**
 * Set the extension for the file to ext.
 * @param {String} ext The extension.  Must include the dot.  Example: .txt
 */
CacheObj.prototype.setExtension = function (ext) {
    if (ext == this.extension && this.file) {
        return; /* It's already set.  No problem. */
    }

    /* Create the nsIFile object */
    var file = ItsAllText.factoryFile();
    file.initWithFile(ItsAllText.getEditDir());
    file.append([this.base_filename, ext].join(''));

    this.extension = ext;
    this.file = file;
    if (file.exists()) {
        this.timestamp = file.lastModifiedTime;
        this.size      = file.fileSize;
    }
};

/**
 * This function looks for an existing file and starts to monitor
 * if the file exists already.  It also deletes all existing files for
 * this cache object.
 */
CacheObj.prototype.initFromExistingFile = function () {
    var base = this.base_filename,
        fobj = ItsAllText.getEditDir(),
        entries = fobj.directoryEntries,
        ext = null,
        tmpfiles = /(\.bak|.tmp|~)$/,
        entry;
    while (entries.hasMoreElements()) {
        entry = entries.getNext();
        entry.QueryInterface(Components.interfaces.nsIFile);
        if (entry.leafName.indexOf(base) === 0) {
            // startswith
            if (ext === null && !entry.leafName.match(tmpfiles)) {
                ext = entry.leafName.slice(base.length);
                continue;
            }
            try {
                entry.remove(false);
            } catch (e) {
                ItsAllText.debug('unable to remove', entry, 'because:', e);
            }
        }
    }
    if (ext !== null) {
        this.setExtension(ext);
        this.private_is_watching = true;
    }
};

/**
 * Returns a unique identifier for the node, within the document.
 * @returns {String} the unique identifier.
 */
CacheObj.prototype.getNodeIdentifier = function (node) {
    var id   = node.getAttribute('id'),
        name,
        doc,
        attr,
        serial;
    if (!id) {
        name = node.getAttribute('name');
        doc = node.ownerDocument.getElementsByTagName('html')[0];
        attr = ItsAllText.MYSTRING + '_id_serial';

        /* Get a serial that's unique to this document */
        serial = doc.getAttribute(attr);
        if (serial) {
            serial = parseInt(serial, 10) + 1;
        } else {
            serial = 1;
        }
        id = [ItsAllText.MYSTRING, 'generated_id', name, serial].join('_');
        doc.setAttribute(attr, serial);
        node.setAttribute('id', id);
    }
    return id;
};

/**
 * Convert to this object to a useful string.
 * @returns {String} A string representation of this object.
 */
CacheObj.prototype.toString = function () {
    return [ "CacheObj",
             " uid=", this.uid,
             " timestamp=", this.timestamp,
             " size=", this.size].join('');
};

/**
 * Write out the contents of the node.
 *
 * @param {boolean} clobber Should an existing file be clobbered?
 */
CacheObj.prototype.write = function (clobber) {
    clobber = typeof(clobber) === 'boolean'?clobber:true;
    var foStream, conv, text;

    if (clobber) {
        foStream = Components.
            classes["@mozilla.org/network/file-output-stream;1"].
            createInstance(Components.interfaces.nsIFileOutputStream);

        /* write, create, truncate */
        foStream.init(this.file, 0x02 | 0x08 | 0x20,
                      parseInt('0600', 8), 0);

        /* We convert to charset */
        conv = Components.
            classes["@mozilla.org/intl/scriptableunicodeconverter"].
            createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
        conv.charset = ItsAllText.getCharset();

        text = conv.ConvertFromUnicode(this.node.value);
        foStream.write(text, text.length);
        foStream.close();

        /* Reset Timestamp and filesize, to prevent a spurious refresh */
        this.timestamp = this.file.lastModifiedTime;
        this.size      = this.file.fileSize;
    } else {
        this.timestamp = this.size = null; // force refresh of textarea
    }

    /* Register the file to be deleted on app exit. */
    Components.classes["@mozilla.org/uriloader/external-helper-app-service;1"].
        getService(Components.interfaces.nsPIExternalAppLauncher).
        deleteTemporaryFileOnExit(this.file);
    return this.file.path;
};

/**
 * Fetches the computed CSS attribute for a specific node
 * @param {DOM} node The DOM node to get the information for.
 * @param {String} attr The CSS-style attribute to fetch (not DOM name).
 * @returns attribute
 */
CacheObj.prototype.getStyle = function (node, attr) {
    var view  = node ? node.ownerDocument.defaultView : null,
        style = view.getComputedStyle(node, '');
    return  style.getPropertyCSSValue(attr).cssText;
};

// @todo [9] IDEA: Pass in the line number to the editor, arbitrary command?
// @todo [9] IDEA: Allow the user to pick an alternative editor?
// @todo [9] IDEA: A different editor per extension?
/**
 * Edit a textarea as a file.
 * @param {String} extension The extension of the file to edit.
 * @param {boolean} clobber Should an existing file be clobbered?
 */
CacheObj.prototype.edit = function (extension, clobber) {
    ItsAllText.debug('edit(', extension, ', ', clobber, ')');
    extension = typeof(extension) === 'string'?extension:this.extension;
    this.setExtension(extension);

    var filename = this.write(clobber),
        program = null,
        process,
        args,
        result,
        ec,
        params,
        procutil;
    procutil = Components.classes["@mozilla.org/process/util;1"];
    this.initial_background = this.node.style.backgroundColor;
    this.initial_color      = this.node.style.color;


    try {
        program = ItsAllText.getEditor();
        // checks
        if (program === null) {
            throw {name: "Editor is not set."};
        }
        if (!program.exists()) {
            throw {name: "NS_ERROR_FILE_NOT_FOUND"};
        }
        /* Mac check because of
         * https://bugzilla.mozilla.org/show_bug.cgi?id=322865 */
        if (!(ItsAllText.isDarwin() || program.isExecutable())) {
            throw {name: "NS_ERROR_FILE_ACCESS_DENIED"};
        }

        // create an nsIProcess
        process = procutil.createInstance(Components.interfaces.nsIProcess);
        process.init(program);

        // Run the process.
        // If first param is true, calling thread will be blocked until
        // called process terminates.
        // Second and third params are used to pass command-line arguments
        // to the process.
        args = [filename];
        result = {};
        ec = process.run(false, args, args.length, result);
        this.private_is_watching = true;
        this.edit_count++;
    } catch (e) {
        params = { out: null,
                   exists: program ? program.exists() : false,
                   path: ItsAllText.preferences.editor,
                   exception: e.name };
        window.openDialog('chrome://itsalltext/content/badeditor.xul',
                          null,
                          "chrome, titlebar, toolbar, centerscreen, modal",
                          params);
        if (params.out !== null && params.out.do_preferences) {
            ItsAllText.openPreferences(true);
            this.edit(extension);
        }
    }
};

/**
 * Delete the file from disk.
 */
CacheObj.prototype.remove = function () {
    if (this.file.exists()) {
        try {
            this.file.remove();
        } catch (e) {
            ItsAllText.debug('remove(', this.file.path, '): ', e);
            return false;
        }
    }
    return true;
};

/**
 * Read the file from disk.
 */
CacheObj.prototype.read = function () {
    /* read file, reset ts & size */
    var DEFAULT_REPLACEMENT_CHARACTER = 65533,
        buffer = [],
        fis,
        istream,
        str;

    try {
        fis = Components.classes["@mozilla.org/network/file-input-stream;1"].
            createInstance(Components.interfaces.nsIFileInputStream);
        fis.init(this.file, 0x01, parseInt('00400', 8), 0);
        // MODE_RDONLY | PERM_IRUSR

        istream = Components.classes["@mozilla.org/intl/converter-input-stream;1"].
            createInstance(Components.interfaces.nsIConverterInputStream);
        istream.init(fis, ItsAllText.getCharset(), 4096, DEFAULT_REPLACEMENT_CHARACTER);

        str = {};
        while (istream.readString(4096, str) !== 0) {
            buffer.push(str.value);
        }

        istream.close();
        fis.close();

        this.timestamp = this.file.lastModifiedTime;
        this.size      = this.file.fileSize;

        return buffer.join('');
    } catch (e) {
        return null;
    }
};

/**
 * Has the file object changed?
 * @returns {boolean} returns true if the file has changed on disk.
 */
CacheObj.prototype.hasChanged = function () {
    /* Check exists.  Check ts and size. */
    return this.private_is_watching &&
           this.file &&
           this.file.exists() &&
           this.file.isReadable() &&
           (this.file.lastModifiedTime != this.timestamp ||
            this.file.fileSize         != this.size);
};

/**
 * Part of the fading technique.
 * @param {Object} pallet A Color blend pallet object.
 * @param {int}    step   Size of a step.
 * @param {delay}  delay  Delay in microseconds.
 */
CacheObj.prototype.fadeStep = function (background_pallet, color_pallet, step, delay) {
    var that = this;
    return function () {
        if (step < background_pallet.length) {
            that.node.style.backgroundColor = background_pallet[step].hex();
            that.node.style.color = color_pallet[step].hex();
            step++;
            setTimeout(that.fadeStep(background_pallet, color_pallet, step, delay), delay);
        } else {
            that.node.style.backgroundColor = that.initial_background;
            that.node.style.color = that.initial_color;
        }
    };
};

/**
 * Node fade technique.
 * @param {int} steps  Number of steps in the transition.
 * @param {int} delay  How long to wait between delay (microseconds).
 */
CacheObj.prototype.fade = function (steps, delay) {
    var color             = this.getStyle(this.node, 'color'),
        color_stop        = new ItsAllText.Color(color),
        color_start       = new ItsAllText.Color('black'),
        color_pallet      = color_start.blend(color_stop, steps),

        background        = this.getStyle(this.node, 'background-color'),
        background_stop   = new ItsAllText.Color(background),
        background_start  = new ItsAllText.Color('yellow'),
        background_pallet = background_start.blend(background_stop, steps);
    setTimeout(this.fadeStep(background_pallet, color_pallet, 0, delay), delay);
};

/**
 * Update the node from the file.
 * @returns {boolean} Returns true ifthe file changed.
 */
CacheObj.prototype.update = function () {
    var value;
    ItsAllText.debug('narf update', this.file.path);
    if (this.hasChanged()) {
        value = this.read();
        if (value !== null) {
            this.fade(20, 100);
            this.node.value = value;
            return true;
        }
    }
    return false; // If we fall through, we
};

/**
 * Capture keypresses to do the hotkey edit.
 */
CacheObj.prototype.keypress = function (event) {
    var km = ItsAllText.marshalKeyEvent(event), cobj;
    if (km === ItsAllText.preferences.hotkey) {
        cobj = ItsAllText.getCacheObj(event.target);
        cobj.edit();
        event.stopPropagation();
    }
    return false;
};

/**
 * The function to execute when a gumdrop is clicked.
 * @param {Object} event The event that triggered this.
 */
CacheObj.prototype.onClick = function (event) {
    var cobj = ItsAllText.getCacheObj(event.target);
    cobj.edit();
    event.stopPropagation();
    return false;
};

/**
 * The function to execute when a gumdrop is right clicked (context)
 * @param {Object} event The event that triggered this.
 */
CacheObj.prototype.onContext = function (event) {
    /* This took forever to fix; roughly 80+ man hours were spent
     * over 5 months trying to make this stupid thing work.
     * The documentation is completely wrong and useless.
     *
     * Excuse me while I scream.
     *
     * See Mozilla bugs:
     * https://bugzilla.mozilla.org/show_bug.cgi?id=287357
     * https://bugzilla.mozilla.org/show_bug.cgi?id=291083
     *
     * This is actually fixed in FF3 by replacing it with something
     * sane....openPopup()
     */
    var cobj = ItsAllText.getCacheObj(event.target),
        popup = ItsAllText.rebuildMenu(cobj.uid);

    if (popup.openPopup) {
        /* FF3 breath of sanity. */
        popup.openPopup(cobj.button, 'end_before',
                        0, cobj.gumdrop_height,
                        true, false);
    } else {
        document.popupNode = popup;
        popup.showPopup(document.documentElement,
                        event.screenX, event.screenY,
                        'popup', false, false);
    }
    event.stopPropagation();
    return false;
};


/**
 * Add the gumdrop to a textarea.
 * @param {Object} cache_object The Cache Object that contains the node.
 */
CacheObj.prototype.addGumDrop = function () {
    var cache_object = this,
        node,
        doc,
        gumdrop,
        parent,
        nextSibling;
    if (cache_object.button !== null) {
        cache_object.adjust();
        return; /*already done*/
    }

    // Add the textarea mouseovers even if the button is disabled
    node = cache_object.node;
    ItsAllText.listen(node, "mouseover", ItsAllText.hitch(cache_object, "mouseover"), false);
    ItsAllText.listen(node, "mouseout",  ItsAllText.hitch(cache_object, "mouseout"),  false);
    ItsAllText.listen(node, "focus",     ItsAllText.hitch(cache_object, "mouseover"), false);
    ItsAllText.listen(node, "blur",      ItsAllText.hitch(cache_object, "mouseout"),  false);
    ItsAllText.listen(node, "keypress",  ItsAllText.hitch(cache_object, "keypress"),  false);
// narf    node.addEventListener( "mouseover",   cache_object.mouseover, false);
// narf    node.addEventListener( "mouseout",    cache_object.mouseout,  false);
// narf    node.addEventListener( "focus",       cache_object.mouseover, false);
// narf    node.addEventListener( "blur",        cache_object.mouseout,  false);
// narf    node.addEventListener( "keypress",    cache_object.keypress,  false);
    if (ItsAllText.getDisableGumdrops()) {
        return;
    }
    ItsAllText.debug('addGumDrop()', cache_object);

    doc = node.ownerDocument;
    if (!node.parentNode) {
        return;
    }

    gumdrop = doc.createElementNS(ItsAllText.XHTMLNS, "img");
    gumdrop.setAttribute('src', this.gumdrop_url);

    if (ItsAllText.getDebug()) {
        gumdrop.setAttribute('title', cache_object.node_id);
    } else {
        gumdrop.setAttribute('title', ItsAllText.localeString('program_name'));
    }
    cache_object.button = gumdrop; // Store it for easy finding in the future.

    // Image Attributes
    gumdrop.style.setProperty('cursor',   'pointer',  'important');
    gumdrop.style.setProperty('display',  'none',     'important');
    gumdrop.style.setProperty('position', 'absolute', 'important');
    gumdrop.style.setProperty('padding',  '0',        'important');
    gumdrop.style.setProperty('margin',   '0',        'important');
    gumdrop.style.setProperty('border',   'none',     'important');
    gumdrop.style.setProperty('zIndex',   '32768',    'important');

    gumdrop.style.setProperty('width',  this.gumdrop_width + 'px', 'important');
    gumdrop.style.setProperty('height', this.gumdrop_height + 'px', 'important');

    gumdrop.setAttribute(ItsAllText.MYSTRING + '_UID', cache_object.uid);

    // Click event handlers
    ItsAllText.listen(gumdrop, "click", ItsAllText.hitch(cache_object, 'onClick'), false);
    ItsAllText.listen(gumdrop, "contextmenu", ItsAllText.hitch(cache_object, 'onContext'), false);
// narf    gumdrop.addEventListener("click",       cache_object.onClick,   false);
// narf    gumdrop.addEventListener("contextmenu", cache_object.onContext, false);

    // Insert it into the document
    parent = node.parentNode;
    nextSibling = node.nextSibling;

    if (nextSibling) {
        parent.insertBefore(gumdrop, nextSibling);
    } else {
        parent.appendChild(gumdrop);
    }

    // Add mouseovers/outs
    ItsAllText.listen(gumdrop, 'mouseover', ItsAllText.hitch(cache_object, 'mouseover'), false);
    ItsAllText.listen(gumdrop, 'mouseout', ItsAllText.hitch(cache_object, 'mouseout'), false);
// narf    gumdrop.addEventListener("mouseover",   cache_object.mouseover, false);
// narf    gumdrop.addEventListener("mouseout",    cache_object.mouseout,  false);

    cache_object.mouseout(null);
    cache_object.adjust();
};

/**
 * Updates the position of the gumdrop, incase the textarea shifts around.
 */
CacheObj.prototype.adjust = function () {
    var gumdrop  = this.button,
        el       = this.node,
        doc      = el.ownerDocument,
        style,
        display,
        cstyle,
        left,
        top,
        coord,
        pos;

    if (ItsAllText.getDisableGumdrops()) {
        if (gumdrop && gumdrop.style.display != 'none') {
            gumdrop.style.setProperty('display', 'none', 'important');
        }
        return;
    }

    style    = gumdrop.style;
    if (!gumdrop || !el) {
        return;
    }
    display  = '';
    cstyle = doc.defaultView && doc.defaultView.getComputedStyle(el, '');
    if ((cstyle && (cstyle.display == 'none' ||
                    cstyle.visibility == 'hidden')) ||
        el.getAttribute('readonly') ||
        el.getAttribute('disabled')
        ) {
        display = 'none';
    }
    if (display === 'none' && style.display != display) {
        style.setProperty('display', display, 'important');
    }

    /**
     * Position the gumdrop.
     * Updates in case the DOM changes.
     */
    pos = ItsAllText.preferences.gumdrop_position;
    if (pos === 'upper-right' || pos === 'lower-right') {
        left = Math.max(1, el.offsetWidth - this.gumdrop_width);
    } else {
        left = 0;
    }
    if (pos === 'lower-left' || pos === 'lower-right') {
        top  = el.offsetHeight;
    } else {
        top  = 0 - this.gumdrop_height;
    }
    if (el.offsetParent === gumdrop.offsetParent) {
        left += el.offsetLeft;
        top  += el.offsetTop;
    } else {
        coord = ItsAllText.getContainingBlockOffset(el, gumdrop.offsetParent);
        left += coord[0];
        top  += coord[1];
    }
    if (left && top) {
        left = [left, 'px'].join('');
        top  = [top, 'px'].join('');
        if (style.left != left) {
            style.setProperty('left', left, 'important');
        }
        if (style.top != top) {
            style.setProperty('top',  top, 'important');
        }
    }
};

/**
 * Creates a mostly unique hash of a string
 * Most of this code is from:
 *    http://developer.mozilla.org/en/docs/nsICryptoHash
 * @param {String} some_string The string to hash.
 * @returns {String} a hashed string.
 */
CacheObj.prototype.hashString = function (some_string) {
    var converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Components.interfaces.nsIScriptableUnicodeConverter),
        result = {},
        data,
        ch,
        hash,
        toHexString,
        retval = [],
        i;
    converter.charset = "UTF-8";

    /* result is the result of the hashing.  It's not yet a string,
     * that'll be in retval.
     * result.value will contain the array length
     */
    result = {};

    /* data is an array of bytes */
    data = converter.convertToByteArray(some_string, result);
    ch   = Components.classes["@mozilla.org/security/hash;1"].createInstance(Components.interfaces.nsICryptoHash);

    ch.init(ch.MD5);
    ch.update(data, data.length);
    hash = ch.finish(true);

    // return the two-digit hexadecimal code for a byte
    toHexString = function (charCode) {
        return ("0" + charCode.toString(36)).slice(-2);
    };

    // convert the binary hash data to a hex string.
    for (i in hash) {
        if (hash.hasOwnProperty(i)) {
            retval[i] = toHexString(hash.charCodeAt(i));
        }
    }

    return (retval.join(""));
};

/**
 * Returns a cache object
 * Note: These UIDs are only unique for Its All Text.
 * @param {Object} node A dom object node or ID to one.
 * @returns {String} the UID or null.
 */
ItsAllText.getCacheObj = function (node) {
    var str = ItsAllText.MYSTRING + "_UID",
        id = null;
    if (typeof(node) === 'string') {
        id = node;
    } else if (node && node.hasAttribute(str)) {
        id = node.getAttribute(str);
    }
    if (id && ItsAllText.tracker.hasOwnProperty(id)) {
        return ItsAllText.tracker[id];
    } else {
        return null;
    }
};

/**
 * Creates a cache object, unless one exists already.
 * Note: These UIDs are only unique for Its All Text.
 * @param {DOMElement} node A dom object node or id to one.
 * @param {Boolean} create_gumdrop Should a gumdrop be created (html).
 * @returns {String} the UID or null.
 */
ItsAllText.makeCacheObj = function (node, create_gumdrop) {
    var cobj = ItsAllText.getCacheObj(node);
    if (!cobj) {
        cobj = new ItsAllText.CacheObj(node);
        if (create_gumdrop) {
            cobj.addGumDrop();
        }
    }
    return cobj;
};
