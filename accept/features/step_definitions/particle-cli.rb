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
  step "the #{out} should contain \"Usage:\""
  step "the #{out} should contain \"Options\""
end