"use strict";
// vim: ts=4 sw=4 sts=4
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
    hitch_re = /^hitched_/,
    doc = node.ownerDocument,
    starting_urlname,
    urlname,
    hash,
    method,
    extension;

    this.uuid = Math.floor(Math.random()*2000);
    //disabled-debug -- itsalltext.debug('CacheObject ', this.uuid, node);

    for (method in this) {
        if (hitch_re.test(method)) {

            //disabled-debug -- itsalltext.debug('CacheObj ', this.uuid, 'hitching ', method, ' -> ', method.replace(hitch_re, ''));
            this[method.replace(hitch_re, '')] = itsalltext.hitch(this, method);
        }
    }

    /* Gumdrop Image URL */
    that.gumdrop_url    = 'chrome://itsalltext/locale/gumdrop.png';
    /* Gumdrop Image Width */
    that.gumdrop_width  = itsalltext.localeString('gumdrop.width');
    /* Gumdrop Image Height */
    that.gumdrop_height = itsalltext.localeString('gumdrop.height');

    that.timestamp = 0;
    that.size = 0;
    that.node = node;
    that.button = null;
    that.initial_background = '';
    that.private_is_watching = false;
    that.button_fade_timer = null;
    that.is_focused = false;
    that.is_listening = false;

    that.node_id = that.getNodeIdentifier(node);

    /* This is a unique identifier for use on the web page to prevent the
     * web page from knowing what it's connected to.
     * @type String
     */
    that.uid = itsalltext.hashString(
        [ doc.location.toString(),
            Math.random(),
            that.node_id ].join(':')
    );
    // @todo [security] Add a serial to the uid hash.

    node.setUserData(itsalltext.MYSTRING + '_UID', that.uid, null);
    itsalltext.addToTracker(that.uid, that);

    /* Figure out where we will store the file.  While the filename can
     * change, the directory that the file is stored in should not!
     */
    hash = itsalltext.hashString(
        [ doc.location.protocol,
            doc.location.port,
            doc.location.search ? doc.location.search : '?',
            doc.location.pathname,
            that.node_id].join(':')
    ).slice(0, 8);

    /* Determine the local filename for the document. */
    // Windows has a max filename length of 129 chars.
    starting_urlname = (doc.location.host + doc.location.pathname)
        .replace(/[\/\\]/g, '_')
        .replace(/\.\.+/g, '.')
        .replace(/[^a-z0-9_.-]+/gi, '')
        .substring(0, 100);
    //disabled-debug -- itsalltext.debug("starting_urlname:", starting_urlname);
    for (urlname = starting_urlname; ;) {
        that.base_filename = [window.encodeURIComponent(urlname), hash].join('.');
        try {
            // Hope isWritable() would work here, but it throws
            // NS_ERROR_FILE_TARGET_DOES_NOT_EXIST if the file is
            // nonexistent.
            this.getFile().isFile();
        } catch (e) {
            switch (e.name) {
              case 'NS_ERROR_FILE_NAME_TOO_LONG':
                if (urlname.length > 0) {
                    urlname = urlname.slice(0, -1);
                    continue;
                }
                break;
              case 'NS_ERROR_FILE_NOT_FOUND':
                break;
              case 'NS_ERROR_FILE_TARGET_DOES_NOT_EXIST':
                break;
              default:
                itsalltext.debug("File naming, falling back to old-style;", e);
                that.base_filename = [window.encodeURIComponent(doc.location.host), hash].join('.');
                break;
            }
        }
        break;
    }
    that.base_filename = [window.encodeURIComponent(urlname), hash].join('.');
    //disabled-debug -- itsalltext.debug("base_filename", that.base_filename);

    /* The current extension.
     * @type String
     */
    that.extension = null;

    /* The number of edits done on this object.
     * @type number
     */
    that.edit_count = 0;

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

        // Refresh the Textarea.
        that.update();
        that.addGumDrop();
    };

    /**
     * A callback for when the textarea/textbox or button has
     * the mouse waved over it and the moved off.
     * @param {Event} event The event object.
     */
    that.mouseout = function (event) {
        //disabled-debug -- itsalltext.debug("mouseout: %o", event, event.target, that.is_focused);
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
        num_frames = (itsalltext.preferences.fade_time * fps),
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
    //disabled-debug -- itsalltext.debug('destroying', this.node_id, this.uid);
    var node = this.node,
    doc  = this.node.ownerDocument,
    html = doc.getElementsByTagName('html')[0];

    //node.removeAttribute(itsalltext.MYSTRING + '_UID');
    //html.removeAttribute(itsalltext.MYSTRING + '_id_serial');

    delete this.node;
    delete this.button;
    this.node = this.button = null;
};

/**
 * Set the extension for the file to ext.
 * @param {String} ext The extension.  Must include the dot.  Example: .txt
 */
CacheObj.prototype.setExtension = function (ext) {
    if (ext == this.extension) {
        return; /* It's already set.  No problem. */
    }

    this.extension = ext;

    /* Create the nsIFile object */
    var file = this.getFile();

    if (file.exists()) {
        this.timestamp = file.lastModifiedTime;
        this.size      = file.fileSize;
    }
};

/**
 * Returns the current extension.
 * @returns {String} The current extension.
 */
CacheObj.prototype.getExtension = function () {
    var extension;
    if (!this.extension) {
        extension = this.node.getAttribute('itsalltext-extension');
        if (typeof(extension) != 'string' || !extension.match(/^[.a-z0-9]+$/i)) {
            extension = itsalltext.getExtensions()[0];
        }
        this.extension = extension;
    }
    return this.extension;
}

/**
 * Returns an nsIFile object for the current file.
 * @returns {nsIFile} A file object for the directory.
 */
CacheObj.prototype.getFile = function () {
    var file = itsalltext.factoryFile(itsalltext.getWorkingDir());
    file.append([this.base_filename, this.getExtension()].join(''));
    return file;
}

/**
 * This function looks for an existing file and starts to monitor
 * if the file exists already.  It also deletes all existing files for
 * this cache object.
 */
CacheObj.prototype.initFromExistingFile = function () {
    var base = this.base_filename,
    fobj = itsalltext.factoryFile(itsalltext.getWorkingDir()),
    entries,
    ext = null,
    last_mtime = 0,
    prev_found = null,
    tmpfiles = /(\.bak|.tmp|~)$/,
    entry;
    if (fobj.exists() && fobj.isDirectory()) {
        entries = fobj.directoryEntries;
        while (entries.hasMoreElements()) {
            entry = entries.getNext();
            entry.QueryInterface(Components.interfaces.nsIFile);
            if (entry.leafName.indexOf(base) === 0) {
                // startswith
                if (entry.lastModifiedTime > last_mtime && !entry.leafName.match(tmpfiles)) {
                    if (prev_found !== null) {
                        try {
                            prev_found.remove(false);
                        } catch (e) {
                            //disabled-debug -- itsalltext.debug('unable to remove', entry, 'because:', e);
                        }
                    }
                    ext = entry.leafName.slice(base.length);
                    last_mtime = entry.lastModifiedTime;
                    prev_found = entry;
                    continue;
                }
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
        attr = itsalltext.MYSTRING + '_id_serial';

        /* Get a serial that's unique to this document */
        serial = doc.getUserData(attr);
        if (serial) {
            serial = parseInt(serial, 10) + 1;
        } else {
            serial = 1;
        }
        id = [itsalltext.MYSTRING, 'generated_id', name, serial].join('_');
        doc.setUserData(attr, serial, null);
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
    var foStream, conv, text, file = this.getFile();

    if (clobber) {
        foStream = Components.
            classes["@mozilla.org/network/file-output-stream;1"].
            createInstance(Components.interfaces.nsIFileOutputStream);

        /* write, create, truncate */
        foStream.init(file, 0x02 | 0x08 | 0x20,
                      parseInt('0600', 8), 0);

                      /* We convert to charset */
                      conv = Components.
                          classes["@mozilla.org/intl/scriptableunicodeconverter"].
                          createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
                      conv.charset = itsalltext.getCharset();

                      text = conv.ConvertFromUnicode(this.node.value);
                      foStream.write(text, text.length);
                      foStream.close();

                      /* Reset Timestamp and filesize, to prevent a spurious refresh */
                      this.timestamp = file.lastModifiedTime;
                      this.size      = file.fileSize;
    } else {
        this.timestamp = this.size = null; // force refresh of textarea
    }

    return file.path;
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
    itsalltext.debug(this.uuid, 'edit(', extension, ', ', clobber, ')', this.uid);
    extension = typeof(extension) === 'string'?extension:this.getExtension();
    this.setExtension(extension);

    var filename = this.write(clobber),
    program = null,
    command,
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
        program = itsalltext.getEditor();

        // checks
        if (program === null) {
            throw {name: "Editor is not set."};
        }

        if (!program.exists()) {
            throw {name: "NS_ERROR_FILE_NOT_FOUND"};
        }

        if (itsalltext.isDarwin() &&
            program.isDirectory() &&
                program.leafName.match(/\.app$/i)) {
            // OS-X .app bundles should be run with open.
            args = ['-a', program.path, filename];
            program = itsalltext.factoryFile('/usr/bin/open');
        } else {
            /* Mac check because of
             * https://bugzilla.mozilla.org/show_bug.cgi?id=322865 */
            if (!(itsalltext.isDarwin() || program.isExecutable())) {
                throw {name: "NS_ERROR_FILE_ACCESS_DENIED"};
            }
            args = [filename];
        }

        // Create an observer.
        var observer          = {
            observe: function (subject, topic, data) {
                // Topic moved as last argument to callbacks since we don't need it (we already know what it is)
                if (topic==='process-finished') {
                    if (typeof(subject.exitValue) != 'undefined' && subject.exitValue != 0) {
                        var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                        .getService(Components.interfaces.nsIPromptService);
                        prompts.alert(null, "Editor exited with status of " + subject.exitValue,
                                      "I ran this command: " + program.path + " " + (args.join(' ')) + "\n\n...and it exited with a status of " + subject.exitValue + ".");
                    }
                    itsalltext.debug("Process exited successfully: ", subject, data);
                }
                else if (topic === 'process-failed') {
                    itsalltext.debug("Process exited unsuccessfully: ", subject, data);
                } else {
                    itsalltext.debug("Observer had a hard time: ", subject, topic, data);
                }
            }
        };

        // create an nsIProcess
        process = procutil.createInstance(Components.interfaces.nsIProcess);
        process.init(program);

        // Run the process.
        if (typeof process.runwAsync == 'undefined') {
            // FF < 4.0
            process.runAsync(args, args.length, observer, false);
        } else {
            // FF >= 4.0 - Wide character support.
            process.runwAsync(args, args.length, observer, false);
        }

        this.private_is_watching = true;
        this.edit_count++;
    } catch (e) {
        itsalltext.debug("Caught error launching editor: ", e);
        params = { out: null,
            exists: program ? program.exists() : false,
            path: itsalltext.preferences.editor,
            exception: e.name };
            window.openDialog('chrome://itsalltext/content/badeditor.xul',
                              null,
                              "chrome, titlebar, toolbar, centerscreen, modal",
                              params);
                              if (params.out !== null && params.out.do_preferences) {
                                  itsalltext.openPreferences(true);
                                  this.edit(extension);
                              }
    }
};

/**
 * Delete the file from disk.
 */
CacheObj.prototype.remove = function () {
    var file = this.getFile();
    if (file.exists()) {
        try {
            file.remove();
        } catch (e) {
            //disabled-debug -- itsalltext.debug('remove(', file.path, '): ', e);
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
    file = this.getFile(),
    buffer = [],
    fis,
    istream,
    str;

    try {
        fis = Components.classes["@mozilla.org/network/file-input-stream;1"].
            createInstance(Components.interfaces.nsIFileInputStream);
        fis.init(file, 0x01, parseInt('00400', 8), 0);
        // MODE_RDONLY | PERM_IRUSR

        istream = Components.classes["@mozilla.org/intl/converter-input-stream;1"].
            createInstance(Components.interfaces.nsIConverterInputStream);
        istream.init(fis, itsalltext.getCharset(), 4096, DEFAULT_REPLACEMENT_CHARACTER);

        str = {};
        while (istream.readString(4096, str) !== 0) {
            buffer.push(str.value);
        }

        istream.close();
        fis.close();

        this.timestamp = file.lastModifiedTime;
        this.size      = file.fileSize;

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
    var file = this.getFile();
    /* Check exists.  Check ts and size. */
    return this.private_is_watching &&
        file.exists() &&
        file.isReadable() &&
        (file.lastModifiedTime != this.timestamp ||
         file.fileSize         != this.size);
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
    color_stop        = new itsalltext.Color(color),
    color_start       = new itsalltext.Color('black'),
    color_pallet      = color_start.blend(color_stop, steps),

    background        = this.getStyle(this.node, 'background-color'),
    background_stop   = new itsalltext.Color(background),
    background_start  = new itsalltext.Color('yellow'),
    background_pallet = background_start.blend(background_stop, steps);
    setTimeout(this.fadeStep(background_pallet, color_pallet, 0, delay), delay);
};

/**
 * Update the node from the file.
 * @returns {boolean} Returns true ifthe file changed.
 */
CacheObj.prototype.update = function () {
    var value;
    if (this.hasChanged()) {
        value = this.read();
        if (value !== null) {
            this.fade(20, 100);
            this.node.value = value;

            var event = this.node.ownerDocument.createEvent("HTMLEvents");
            event.initEvent('change', true, false);
            this.node.dispatchEvent(event);

            var inputEvent = this.node.ownerDocument.createEvent("HTMLEvents");
            inputEvent.initEvent('input', true, false);
            this.node.dispatchEvent(inputEvent);

            return true;
        }
    }
    return false; // If we fall through, we
};

/**
 * Capture keypresses to do the hotkey edit.
 */
CacheObj.prototype.hitched_keypress = function (event) {
    itsalltext.debug(this.uuid, 'keypress()', event);
    var km = itsalltext.marshalKeyEvent(event), cobj;
    if (km === itsalltext.preferences.hotkey) {
        cobj = CacheObj.get(event.target);
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
    //disabled-debug -- itsalltext.debug('onClick()', event);
    var cobj = CacheObj.get(event.target);
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
    var cobj = CacheObj.get(event.target),
    popup = itsalltext.rebuildMenu(cobj.uid);

    popup.openPopup(cobj.button, 'end_before',
                    0, 0,
                    true, false);

                    event.stopPropagation();
                    event.preventDefault();
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

    try {
        itsalltext.monitor.incrementLock();

        if (cache_object.button !== null) {
            cache_object.adjust();
            itsalltext.monitor.decrementLock();
            return; /*already done*/
        }

        // Add the textarea mouseovers even if the button is disabled
        node = cache_object.node;
        itsalltext.debug('addGumDrop', cache_object.uuid, node);
        if (!cache_object.is_listening) {
            itsalltext.listen(node, "mouseover", itsalltext.hitch(cache_object, "mouseover"), false);
            itsalltext.listen(node, "mouseout",  itsalltext.hitch(cache_object, "mouseout"),  false);
            itsalltext.listen(node, "focus",     itsalltext.hitch(cache_object, "mouseover"), false);
            itsalltext.listen(node, "blur",      itsalltext.hitch(cache_object, "mouseout"),  false);
            itsalltext.listen(node, "keypress",  cache_object.keypress,  false);
            cache_object.is_listening = true;
        }
        if (itsalltext.getDisableGumdrops()) {
            itsalltext.monitor.decrementLock();
            return;
        }
        itsalltext.debug('addGumDrop()', cache_object);

        doc = node.ownerDocument;
        if (!node.parentNode) {
            itsalltext.monitor.decrementLock();
            return;
        }

        gumdrop = doc.createElementNS(itsalltext.XHTMLNS, "img");
        gumdrop.setAttribute('src', this.gumdrop_url);

        if (itsalltext.getDebug()) {
            gumdrop.setAttribute('title', cache_object.node_id);
        } else {
            gumdrop.setAttribute('title', itsalltext.localeString('program_name'));
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

        gumdrop.setUserData(itsalltext.MYSTRING + '_UID', cache_object.uid, null);

        // Click event handlers
        itsalltext.listen(gumdrop, "click", itsalltext.hitch(cache_object, 'onClick'), false);
        itsalltext.listen(gumdrop, "contextmenu", itsalltext.hitch(cache_object, 'onContext'), false);

        // Insert it into the document
        parent = node.parentNode;
        nextSibling = node.nextSibling;

        if (nextSibling) {
            parent.insertBefore(gumdrop, nextSibling);
        } else {
            parent.appendChild(gumdrop);
        }

        // Add mouseovers/outs
        itsalltext.listen(gumdrop, 'mouseover', itsalltext.hitch(cache_object, 'mouseover'), false);
        itsalltext.listen(gumdrop, 'mouseout', itsalltext.hitch(cache_object, 'mouseout'), false);

        cache_object.mouseout(null);
        cache_object.adjust();
    } catch (e) {
        itsalltext.monitor.decrementLock();
    }
    itsalltext.monitor.decrementLock();
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

    if (itsalltext.getDisableGumdrops()) {
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
                            el.readOnly ||
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
       pos = itsalltext.preferences.gumdrop_position;
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
           coord = itsalltext.getContainingBlockOffset(el, gumdrop.offsetParent);
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
 * Returns a cache object
 * Note: These UIDs are only unique for Its All Text.
 * @param {Object} node A dom object node or ID to one.
 * @returns {String} the UID or null.
 */
CacheObj.get = function (node) {
    var str = itsalltext.MYSTRING + "_UID",
    id = null;
    if (typeof(node) === 'string') {
        id = node;
    } else if (node && node.getUserData(str)) {
        id = node.getUserData(str);
    }
    return itsalltext.getFromTracker(id);
};

/**
 * Creates a cache object, unless one exists already.
 * Note: These UIDs are only unique for Its All Text.
 * @param {DOMElement} node A dom object node or id to one.
 * @param {Boolean} create_gumdrop Should a gumdrop be created (html).
 * @returns {String} the UID or null.
 */
CacheObj.make = function (node, create_gumdrop) {
    var cobj = CacheObj.get(node);
    // Too noisy itsalltext.debug('CacheObj.make(',node,', ', create_gumdrop,') = ',cobj, ' : ', cobj ? cobj.uid : 'null');
    if (!cobj) {
        cobj = new CacheObj(node);
        if (create_gumdrop) {
            cobj.addGumDrop();
        }
    }
    return cobj;
};
