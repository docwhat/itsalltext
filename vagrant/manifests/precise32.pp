
exec { "apt-update":
  command => "/usr/bin/apt-get update"
}

Exec["apt-update"] -> Package <| |>

package { "firefox":
  ensure  => latest,
}
package { "vim-athena":
  ensure  => latest,
}

file { "/home/vagrant/bin":
  ensure => 'directory',
  mode   => '0755',
  owner  => 'vagrant',
}

file { "/home/vagrant/bin/ff.sh":
  source  => "file:///vagrant/vagrant/files/ff.sh",
  mode    => '0755',
  owner   => 'vagrant',
  require => File['/home/vagrant/bin'],
}

