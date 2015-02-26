# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure('2') do |config|
  config.vm.define 'linux', autostart: false do |linux|
    linux.vm.box = 'precise32'
    linux.vm.box_url = 'http://files.vagrantup.com/precise32.box'

    linux.ssh.forward_agent = true
    linux.ssh.forward_x11 = true

    config.vm.provision 'shell', inline: <<-SHELL
      sudo apt-get update
      sudo apt-get install -y vim-athena firefox
    SHELL

    linux.vm.provider :virtualbox do |vb|
      vb.gui = true
      vb.memory = 1024
      vb.cpus = 1
    end
  end

  config.vm.define 'windows', autostart: false do |windows|
    windows.vm.box = 'win7-ie11'
    windows.vm.box_url = 'http://aka.ms/vagrant-win7-ie11'
    windows.vm.guest = :windows
    windows.vm.communicator = 'winrm'

    windows.vm.provider :virtualbox do |vb|
      vb.gui = true
      vb.memory = 2048
      vb.cpus = 2
    end
  end
end
