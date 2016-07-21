require 'diff_dirs'

Given(/^I run particle ([^"`].*)$/) do |arg|
  step "I run `particle #{arg}`"
end

Given(/^I run particle "([^"]*)"$/) do |arg|
  step "I run `particle #{arg}`"
end

Given(/^I have installed the CLI$/) do
  # will take care of this later. For now, we assume the CLI has been installed locally using npm install
end

And(/^the (stderr|stdout|output) should show the help page$/) do |out|
  step "the #{out} should contain \"Common Commands:\""
end

And(/^the (stderr|stdout|output) should show the new help page$/) do |out|
  step "the #{out} should contain \"Usage:\""
  step "the #{out} should contain \"Options\""
  step "the #{out} should match exactly once /--help\\s+Provides extra details and options for a given command/"
end


And(/^the (stderr|stdout|output) should match exactly once \/([^\/]*)\/$/) do |out, expected|
  step "the #{out} should match /#{expected}/"
  step "the #{out} should not match /#{expected}.*#{expected}/"
end


And(/^the directories "([^"]*)" and "([^"]*)" should be equal$/) do |dir1, dir2|
  result = diff_dirs expand_path(dir1), expand_path(dir2)
  expect(result).to eq([])
end