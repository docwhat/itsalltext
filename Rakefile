if RUBY_VERSION >= '1.9'
	Encoding.default_external = Encoding::UTF_8
	Encoding.default_internal = Encoding::UTF_8
end
require_relative 'version'
require 'paint'
require 'set'

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
LOCALE_DIR = 'src/chrome/locale'
FAVORED_LANGUAGE = 'en-US'
LANGUAGES = Dir["#{LOCALE_DIR}/*"].select { |p| File.directory?(p) }.map { |p| File.basename(p) }.select { |p| p =~ %r{[a-z]{2}-[A-Z]{2}} && p != FAVORED_LANGUAGE }.sort.freeze

task :default => :build

desc "Build add-on #{VERSION}"
task :build => [:verify, XPI_FILENAME]

desc "Install It's All Text! into firefox"
task :install => [:verify, :build] do
  sh 'open', '-a', 'Firefox', XPI_FILENAME
end

desc "Clean up temporary files"
task :clean do
  rm_rf 'final'
end

desc "Verify all translations are in place"
task :verify do
  errors = []
  LANGUAGES.each { |language| errors << diff_locale(language) }
  errors = errors.flatten.select { |e| !e.nil? }
  if errors.size > 0
    errors.each { |error| puts "ERROR: #{error}" }
    fail "There were problems with the translations."
  end
end

def load_dtd_entities file
  Set.new(File.readlines(file).map do |line|
    $1.to_s if line =~ %r{^<!ENTITY\s+(\S+)}
  end.select { |e| !e.nil? })
end

def find_dtd_errors source_file, file_to_check
  source  = load_dtd_entities source_file
  checkee = load_dtd_entities file_to_check

  errors = []
  if (source - checkee).size > 0
    errors << "You're missing entities in #{file_to_check}: #{(source - checkee).to_a.join(', ')}"
  end
  if (checkee - source).size > 0
    errors << "You have extra entities in #{file_to_check}: #{(checkee - source).to_a.join(', ')}"
  end

  errors
end

def load_properties_entities file
  Set.new(File.readlines(file).map do |line|
    $1.to_s if line =~ %r{^\s*(\S+)\s*=}
  end.select { |e| !e.nil? })
end

def find_properties_errors source_file, file_to_check
  source  = load_properties_entities source_file
  checkee = load_properties_entities file_to_check

  errors = []
  if (source - checkee).size > 0
    errors << "You're missing props in #{file_to_check}: #{(source - checkee).to_a.join(', ')}"
  end
  if (checkee - source).size > 0
    errors << "You have extra props in #{file_to_check}: #{(checkee - source).to_a.join(', ')}"
  end

  errors
end

def diff_locale language
  errors = []

  Dir[File.join LOCALE_DIR, FAVORED_LANGUAGE, '*'].each do |fav_file|
    other_file = File.join LOCALE_DIR, language, File.basename(fav_file)
    extension = File.extname fav_file
    if ! File.exists?(other_file)
      errors << "The file #{other_file} is missing!"
      next
    end

    if extension == '.dtd'
      errors << find_dtd_errors(fav_file, other_file)
    elsif extension == '.properties'
      errors << find_properties_errors(fav_file, other_file)
    end
  end

  errors.flatten.select { |e| !e.nil? }
end

file "final" => FIREFOX_SOURCES + ['version.rb'] do |t|
  rm_rf 'final'
  t.prerequisites.each do |src|
    next unless src =~ %r{\Asrc}
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

file XPI_FILENAME => "final" do |t|
  rm_f t.name
  xpi_path = File.expand_path(t.name)
  Dir.chdir "final" do
    sh "zip", "-q", xpi_path, *Dir['**/*']
  end

  puts
  puts Paint["Don't forget to bump the version number if #{VERSION} isn't correct!", :cyan]
  puts Paint["git tag release-#{VERSION} ; git push --tags", :cyan]
end
