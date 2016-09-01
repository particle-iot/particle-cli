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
