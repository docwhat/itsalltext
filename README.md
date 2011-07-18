# It's All Text!

*It's All Text!* is an addon for Firefox.  It will, with version 2.0, be available for all browsers.

Ever had to type text into an edit box on some web page?  If it was longer than one sentence, then you need *It's All Text!*

This miracle extension provides an edit button for any edit box (AKA `textarea`) on any page or your money back (I have an abundance of nothing to give you)!

After installing *It's All Text* you'll see a little "edit" button next to each edit box. Click it. If this is the first time you've used *It's All Text!* then you will be asked to set your preferences; the most important one is your editor.

The text from the edit box will pop up in your selected editor. When you save it, it'll refresh in the web page. Wait for the magic yellow glow that means that the radiation has taken effect!

Remember, with great power outages come great responsibility outages.

Ciao! -  Christian Höltje

# Download location

You can download *It's All Text!* from [Mozilla Add-Ons](https://addons.mozilla.org/en-US/firefox/addon/its-all-text/).

# FAQ

## How do I do something more complicated than just running an editor with a file-name?

In UNIX systems, such as Mac OS X or Linux, you can create a shell script with your commands in it. You then set the preferences to launch this script.

Example:

    #!/bin/bash
    set -eu
    exec /usr/bin/myfavoriteditor --option "$@"

In Microsoft Windows, you can create a .cmd script instead. Again, you set your preferences to launch this .cmd script.

An example for [JEdit](http://www.jedit.org/) in Windows:

    @echo off
    
    C:\WINDOWS\system32\javaw.exe -Xms64M -Xmx192M -jar "C:\www\jEdit\jedit.jar" -reuseview %1

(thanks to Russell)

## Where is the edit button for (gmail, blogger, etc.)?

Gmail, blogger, and other sites has the option to use "rich text editors". The editors act similar to a word processor. Due to the way these work, it isn't possible for *It's All Text!* find the `textarea`, it is hidden or, in some cases, absent.

**Workaround:** Turn off the rich text editor, if possible.

## Why do my non-ASCII characters turn into blocks or question marks?

The problem is that the encoding *It's All Text!* is using and your editor is using don't match. You can figure out what encoding your editor wants and change the encodings preference in *It's All Text!* or you can change the encoding your editor uses.

In Microsoft Windows, a common problem I get is that someone is using Notepad or WordPad. These both have lousy support for encode. I recommend getting something like  [Notepad++](http://notepad-plus.sourceforge.net/) for editing in UTF-8 instead.

## I'm having trouble with Mac OS X...help?

Out of the box, *It's All Text!* uses the `open` program. open behaves like double clicking on a file. It uses the type of the file to choose the correct application to run; for `.txt` files, that application is the built-in text editor. If this behavior is fine for you, then leave the editor option alone and enjoy! However, if you want to use a different editor or to force the same editor regardless of the file type, then you will need to do something a little more complicated. Firefox cannot run `.app` applications directly.

To run a `.app` program in Mac OS X you need to do one of two things:

* If your editor comes with a non-.app version, then use that.
* Otherwise you have to write a shell script.

Check your editor's documentation.

 if it comes with a standalone program, usually located in the `/usr/bin/` or `/usr/local/bin` directory, then you can enter that into the *It's All Text!* preferences and you're done.

Otherwise, you need to create a shell script. Here are the basic steps to create a shell script:

1. Open your favorite editor.
2. Create a file like the example below.
3. Save it to your home directory: ~/iat.sh
4. Open a terminal window.
5. Type this command to make the shell script executable: chmod +x ~/iat.sh
6. In *It's All Text!* preferences, use the shell script as your editor.

The example shell script: Replace `/Applications/TextEdit.app` with the actual path to your `.app` file. It'll probably be something like `/Applications/MyEditor.app`.

    #!/bin/sh
    # This is an example shell script for It's All Text!
    
    if [ ! -f "$1" ]; then
      touch "$1"
    fi
    
    # Remove quarantine bit that may get set for extensions MacOSX doesn't
    # recognize, and that may cause an unneeded security dialog to appear. (We
    # *know* there are no viruses on this file, 'cause we just created it)
    xattr -d com.apple.quarantine "$1" 
    
    exec /usr/bin/open -a Vim "$1"
    #EOF

Other alternative shell scripts are available [here](http://docwhat.gerf.org/2007/03/its_all_text_v06/#comment-2054).

# Bug Reports

Please use github to submit any new bug reports or issues.  If you don't feel comfortable with github, then feel free to [contact me directly](http://docwhat.org/email).

# Contributing

Check out the source from [github](http://github.com/).  When you have a suggested fix, then fork my project and send me a pull request with your change.  Ideally, you should create a local branch in git for your change.  This makes everyone's life easier.

# Version 2.0

Version 2.0 will work on a completely different mechanism which will allow it work across Chrome, Firefox, and any other browser that has plugins that do ajax requests.

I'm currently working on that over in my [iated](http://github.com/docwhat/iated/) project.
