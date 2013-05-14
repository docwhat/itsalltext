require 'paint'

VERSION="1.8.0"
XPI_FILENAME = "itsalltext-#{VERSION}.xpi"

FIREFOX_SOURCE_EXTENSIONS = [
  'dtd',
  'js',
  'manifest',
  'png',
  'properties',
  'rdf',
  'txt',
  'xul',
]
FIREFOX_SOURCES = FIREFOX_SOURCE_EXTENSIONS.map { |x| Dir["src/**/*.#{x}"] }.flatten.freeze

task :default => :build

desc "Build add-on #{VERSION}"
task :build => [XPI_FILENAME]

# Alias, because I forget.
task :release => [:build]

desc "Install It's All Text! into firefox"
task :install => :build do
  sh 'open', '-a', 'Firefox', XPI_FILENAME
end

desc "Clean up temporary files"
task :clean do
  rm_rf 'final'
end

file "final" => FIREFOX_SOURCES do |t|
  rm_rf 'final'
  t.prerequisites.each do |src|
    dst = src.sub(%r{\Asrc/}, 'final/')
    dst_parent = File.dirname(dst)
    mkdir_p dst_parent unless File.directory?(dst_parent)
    if src.end_with?('.js') || src.end_with?('.rdf')
      puts "versioning #{src} #{dst}"
      File.open(dst, 'w') do |f|
        f.write File.read(src).gsub(%r{999\.@@VERSION@@}, VERSION)
      end
    else
      cp src, dst
    end
  end
end

file XPI_FILENAME => ["final"] do |t|
  rm_f t.name
  xpi_path = File.expand_path(t.name)
  Dir.chdir "final" do
    sh "zip", "-q", xpi_path, *Dir['**/*']
  end

  puts
  puts Paint["Don't forget to bump the version number if #{VERSION} isn't correct!", :cyan]
  puts Paint["git tag release-#{VERSION} ; git push --tags", :cyan]
end
