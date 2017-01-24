# Global variables to hold statistics for the summary report at the end.
$diffCount = 0
$itemCount = 0
$skippedCount = 0
$errorCount = 0

# Returns true if fileA and fileB both exist, both are the same size, and pass
# the random sample comparison test.
def sameFile( fileA, fileB )

  # If symlinks, make sure they link to the same thing.
  if File.symlink?( fileA ) || File.symlink?( fileB )
    return false unless File.symlink?( fileA ) and File.symlink?( fileB )
    linkA = File.readlink( fileA )
    linkB = File.readlink( fileB )
    return linkA == linkB
  end

  # Both exist.
  return false unless File.exists?( fileA ) and File.exists?( fileB )
  # Both are the same size.
  aBytes = File.stat( fileA ).size
  bBytes = File.stat( fileB ).size
  return false unless aBytes == bBytes

  # Random sample comparison.
  same = true
  $options[:samples].times do
    start = rand( aBytes )
    length = [aBytes, start + SampleSize].min - start + 1
    aSample = File.read( fileA, length, start )
    bSample = File.read( fileB, length, start )
    same = same && aSample == bSample
  end
  return same
rescue
  STDOUT.puts "ERROR: Can't read file [#{fileA}]"
  $errorCount += 1
  return true # So we don't get two messages for the same file
end

# Returns the number of items in the directory (and subdirectories of) 'dir'
def countItems( dir )
  if $options[:verbose]
    STDOUT.puts "DEBUG: Counting files in [#{dir}]"
  end

  count = 0
  Dir.foreach( dir ) do |item|
    next if item == "." or item == ".."
    count += 1
    fullPath = File.join( dir, item )
    count += countItems( fullPath ) if File.directory? fullPath
  end
  return count
end

# Recursively compare directories specified by a path relative to $original and
# $backup.
def compareDirs( relative = "" )
  # Combine the base path with the relative path
  original = File.expand_path( File.join( $original, relative ) )
  backup = File.expand_path( File.join( $backup, relative ) )

  # Return if this directory has been excluded
  if $options[:ignore].include?( original ) or $options[:ignore].include?( backup )
    $skippedCount += 1
    STDOUT.puts "SKIP: Skipping comparison of [#{original}] and [#{backup}]"
    return
  end

  # Make sure both directories exist
  unless File.directory?( original ) and File.directory?( backup )
    STDOUT.puts "DIR: [#{original}] not found in [#{backup}]"
    $diffCount += 1
    $diffCount += countItems( original ) if $options[:count]
    return
  end

  # If both directories exist, we check their contents
  begin
    Dir.foreach( original ) do |item|
      next if item == "." or item == ".."
      $itemCount += 1

      origPath = File.join( original, item )
      backupPath = File.join( backup, item )

      if File.directory? origPath
        # Skip symlinks if told to do so...
        if File.symlink?( origPath ) and not $options[:follow]
          $skippedCount += 1
          STDOUT.puts "SYMLINK: [#{origPath}] skipped."
          next
        end
        # Stay on one filesystem if told to do so...
        outerDev = File::Stat.new( original ).dev
        innerDev = File::Stat.new( origPath ).dev
        if outerDev != innerDev and $options[:one_filesystem]
          $skippedCount += 1
          STDOUT.puts "DIFFFS: [#{origPath}] is on a different file system. Skipped."
          next
        end
        compareDirs( File.join( relative, item ) )
      else # It's a file
        unless sameFile( origPath, backupPath )
          $diffCount += 1
          STDOUT.puts "FILE: [#{origPath}] not found at, or doesn't match [#{backupPath}]"
        end
      end
    end # Dir.foreach
  rescue Errno::EACCES
    STDOUT.puts "ERROR: Can't read directory [#{original}]"
    $errorCount += 1
  end
end # compareDirs


def dirDiff( dir1, dir2 )
  $original = File.expand_path( dir1 )
  $backup = File.expand_path( dir2 )

  $options = {}
  $options[:ignore] = []

  compareDirs

  $diffCount
end