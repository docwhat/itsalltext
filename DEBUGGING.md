# Debugging ...
## ...or how to help the developer not lose his mind.

Thank you for considering helping me debug a problem with [It's All Text!](http://github.com/docwhat/itsalltext).

This document will help you set up debugging and then remove it once you're done.  You'll probably want to remove some of these debugging methods when you finish because it slows down Firefox.  Unless you debug regularly (you're a web or extension developer) you probably don't need these tools day-to-day.

## Preparation

You may want to save a copy of this document to disk or open it in a different browser so you can read it while you're restarting and debugging Firefox.

You'll also want at text editor or an open email to collect any interesting information.

### Setting up a new profile (optional)

You may want to set up a new profile.  A profile is all your personal settings for Firefox -- the extensions, bookmarks, preferences, etc.

There are several advantages to setting up a new profile for debugging IAT:

1. You won't change your normal settings.
2. Cleanup is easy, just switch profiles back to your normal profile.
3. It makes debugging problems caused by extensions interacting with IAT.
4. You start with default settings for your platform.

If this sounds good to you, then go read the [managing profiles article](http://support.mozilla.com/en-US/kb/Managing-profiles) in the Mozilla knowledge-base.

Once you've set up a new debugging profile and are running it by restarting Firefox, then you'll want to go install the version of It's All Text! you'll be debugging.  You should have either gotten an `.xpi` file directly from Christian Höltje or you can get any previously released version from [Addons.Mozzilla.Org](https://addons.mozilla.org/en-US/firefox/addon/its-all-text/versions/).

The TL;DR version is to run the following command (for Windows and Linux only, alas):

```bash
firefox -ProfileManager
```

## Level 1 Debugging - Error Console

This is the easiest method of debugging.  It involves turning on debugging in It's All Text! and opening the Error Console.  Unfortunately, it returns the least amount of info unless IAT itself is crashing someplace.

### Turning on debugging in IAT

1. Go to the URL `about:config`
2. In the "filter" box, type `itsalltext.debug`
3. Double-click on "false" in the "value" column so that it says "true"

### Open the Error Console

You open the Error Console via <kbd>CTRL</kbd>+<kbd>SHIFT</kdb>+<kbd>J</kbd>.

1. Verify that it is set to show "all" errors, messages, etc.  Click the "all" tab/button.
2. Check the Error Console for any errors from It's All Text! during startup.  If there are any, then you should copy and paste them into your notes and mark them as start-up errors.
3. Clear the console. This is to make finding problems easier.

### Debug

If you're debugging "normal usage" of IAT, then you can go to [http://docwhat.org/files/iat] and walk through those tests one by one.

After each step check your Error Console and see if any errors from IAT have appeared.  Make note of any that do appear.  It's okay to record too much, we can clean up the info later.

You may want to clear the Error Console regularly to make finding new messages easier.

### Send Christian Höltje your notes.

You can [email](http://docwhat.org/email/) the notes, reply to an existing email, or append your notes to an [issue](http://github.com/docwhat/itsalltext/issues) on github.

### Teardown

If you didn't use a new profile, you'll want to turn debugging back off in `about:config`.

## Level 2 Debugging - Firebug

This is a little more involved but still not very difficult.

### Install Firebug

Go to the [firebug webpage](http://getfirebug.com/) and install the latest version of Firebug.

### Turning on debugging in IAT

See the section for level 1

### Open the Error Console

See the section for level 1

### Open the Firebug console

1. Click the Firebug icon in the upper right corner.
2. Click on the "Console" tab in the new frame that opened up.

### Debugging

Make sure you have the Firebug console open.  

If you're debugging "normal usage" of IAT, then you can go to [http://docwhat.org/files/iat] and walk through those tests one by one.

After each step check your Error Console and the Firebug Console and see if any errors from IAT have appeared.  Make note of any that do appear.  It's okay to record too much, we can clean up the info later.

You may want to clear the Error Console and the Firebug Console regularly to make finding new messages easier.

Note that messages in Firebug aren't just errors. It shows a lot of details about what IAT is doing behind the covers.

### Send Christian Höltje your notes.

You can [email](http://docwhat.org/email/) the notes, reply to an existing email, or append your notes to an [issue](http://github.com/docwhat/itsalltext/issues) on github.

### Teardown

If you didn't use a new profile, then you'll want to uninstall Firebug and turn off debugging in `about:config`

## Level 3 Debugging - Firefox logging

This is a somewhat complicated form of debugging and I'll assume you're pretty comfortable with Firefox, your operating system, etc.

**WARNING:** You will definitely want to set up a new profile in this case.

### Do the steps for level 1 and 2.

'nuf said.

### Setup a "Developer Environment"

Follow the instructions for [setting up extension development environment](https://developer.mozilla.org/en/Setting_up_extension_development_environment).

### Run Firefox

You need to run Firefox from a terminal so that you can see the output.  You may also want to redirect this output to a file.  For example, on a Unix system you can use `tee` for this if your operating system supports it.

### Debugging

You'll now have three sources of information:

* The Error Console
* The Firebug Console
* The output from running Firefox

If you're debugging "normal usage" of IAT, then you can go to [http://docwhat.org/files/iat] and walk through those tests one by one.

After each step check your Error Console and the Firebug Console and see if any errors from IAT have appeared.  Make note of any that do appear.  It's okay to record too much, we can clean up the info later.

You may want to clear the Error Console and the Firebug Console regularly to make finding new messages easier.

Note that messages in Firebug aren't just errors. It shows a lot of details about what IAT is doing behind the covers.

### Send Christian Höltje your notes.

You can [email](http://docwhat.org/email/) the notes, reply to an existing email, or append your notes to an [issue](http://github.com/docwhat/itsalltext/issues) on github.

### Teardown

If you didn't use a new profile, then you'll want to uninstall Firebug and turn off debugging in `about:config`

### Level 4 -- Debugging with a debugger

If you're proficient enough to do this, I won't need to explain too much to you.  I'd recommend following the setup steps for Level 3 debugging.

You'll also want to install [Venkman](https://developer.mozilla.org/en/Venkman), even if you use Firebug to do JS debugging.

## Getting Help

You can contact me via [email](http://docwhat.org/email/) or via IM or IRC.  See [my homepage](http://docwhat.org/) for my "Alter Egos" (in the sidebar) to find a way to talk to me directly.
