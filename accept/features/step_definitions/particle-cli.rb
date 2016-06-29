Given(/^I run particle ([^"`].*)$/) do |arg|
  step "I run `particle #{arg}`"
end

Given(/^I run particle "([^"]*)"$/) do |arg|
  step "I run `particle #{arg}`"
end