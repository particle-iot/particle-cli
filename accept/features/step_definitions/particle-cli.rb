require 'diff_dirs'

Given(/^I run particle ([^"`].*)$/) do |arg|
  step "I run `particle #{arg}`"
end

Given(/^I run particle "([^"]*)"$/) do |arg|
  step "I run `particle #{arg}`"
end

Given(/^I run particle "([^"]*)" interactively$/) do |arg|
  step "I run `particle #{arg}` interactively"
end

Given(/^The particle library "([^"]*)" is removed$/) do |lib|
  step "I delete the particle library \"#{lib}\""
end

When(/^I delete the particle library "([^"]*)"$/) do |lib|
  step "I run particle \"library delete #{lib}\""
end

Given(/^I copy the library resource "([^"]*)" to "([^"]*)"$/) do |resource, target|
  step "I run `bash ../../bin/copyLibraryResource.sh #{resource} #{target}`"
  step 'the exit status should be 0'
end

Given(/^I have installed the CLI$/) do
  # will take care of this later. For now, we assume the CLI has been installed locally using npm install
end

And(/^the (stderr|stdout|output) should show the help page$/) do |out|
  step "the #{out} should show the old help page"
end

And(/^the (stderr|stdout|output) should show the old help page$/) do |out|
  step "the #{out} should contain \"Usage: particle <command_name> <arguments>\""
  step "the #{out} should contain \"Common Commands:\""
  step "the #{out} should contain \"library\""
  step "the #{out} should contain \"help\""
  step "the #{out} should contain \"setup\""
  step "the #{out} should contain \"device\""
end

And(/^the (stderr|stdout|output) should show the new help page$/) do |out|
  step "the #{out} should contain \"Commands:\""
  step "the #{out} should contain \"help\""
  step "the #{out} should contain \"library\""
  step "the #{out} should contain \"Usage:  <command>\""
  step "the #{out} should contain \"Options\""
  step "the #{out} should contain \"--verbose\""
  step "the #{out} should match exactly once /help\\s+Provides extra details and options for a given command/"
end


And(/^the (stderr|stdout|output) should match exactly once \/([^\/]*)\/$/) do |out, expected|
# todo - the aruba commands only have regex matching on the complete output.
  step "the output should match /#{expected}/"
  step "the output should not match /#{expected}.*#{expected}/"
end


And(/^the directories "([^"]*)" and "([^"]*)" should be equal$/) do |dir1, dir2|
  result = diff_dirs expand_path(dir1), expand_path(dir2)
  expect(result).to eq([])
end

CONTROL_CODES = {
  '<Up>'    => "\e[A",
  '<Down>'  => "\e[B",
  '<Right>' => "\e[C",
  '<Left>'  => "\e[D",
}

When(/^I respond to the prompt "([^"]*)" with code "([^"]*)"$/) do |prompt, response|
  response_control = response.gsub(/<[A-Za-z0-9]+>/, CONTROL_CODES)
  step "I respond to the prompt \"#{prompt}\" with \"#{response_control}\""
end


When(/^I respond to the prompt "([^"]*)" with "([^"]*)"$/) do |prompt, response|
  begin
    Timeout.timeout(aruba.config.exit_timeout) do
      loop do
        begin
          expect(last_command_started).to have_interactive_stdout an_output_string_including(prompt)
        rescue RSpec::Expectations::ExpectationNotMetError
          sleep 0.1
          retry
        end
        break
      end
    end
  rescue TimeoutError
    expect(last_command_started).to have_interactive_stdout an_output_string_including(prompt)
  end
  step "I type \"#{response}\""
end

RSpec::Matchers.define :have_interactive_stdout do |expected|
  match do |actual|
    @actual = sanitize_text(actual.stdout)

    values_match?(expected, @actual)
  end

  diffable

  description { "have output: #{description_of expected}" }
end

When(/^I wait until the device "([^"]*)" is online$/) do |device|
  begin
    Timeout.timeout(aruba.config.exit_timeout) do
      loop do
        begin
          step %Q(I run `particle list #{device}`)
          step %Q(the output should contain "is online")
        rescue RSpec::Expectations::ExpectationNotMetError
          sleep 0.1
          retry
        end
        break
      end
    end
  rescue TimeoutError
    fail StandardError.new("Device #{device} is not online")
  end
end
