# -*- mode: ruby -*-
# vi: set ft=ruby :

linux_provision_sh = <<SHELL
set -x
sudo -u vagrant -H gsettings set org.gnome.desktop.lockdown    disable-lock-screen    true
sudo -u vagrant -H gsettings set org.gnome.desktop.screensaver ubuntu-lock-on-suspend false
echo '/vagrant/src' > /usr/lib/firefox-addons/extensions/'itsalltext@docwhat.gerf.org'
SHELL

Vagrant.configure('2') do |config|
  config.vm.define 'linux', autostart: false do |linux|
    linux.vm.box = 'boxcutter/ubuntu1604-desktop'

    linux.ssh.forward_agent = true
    linux.ssh.forward_x11 = true

    linux.vm.provision 'shell', inline: linux_provision_sh

    linux.vm.provider :virtualbox do |vb|
      vb.gui = true
      vb.memory = 1024
      vb.cpus = 1
    end
  end

  config.vm.define 'windows', autostart: false do |windows|
    windows.vm.box = 'mwrock/Windows2012R2'
    windows.vm.guest = :windows
    windows.vm.communicator = 'winrm'

    windows.vm.provider :virtualbox do |vb|
      vb.gui = true
      vb.memory = 2048
      vb.cpus = 2
    end
  end
end
