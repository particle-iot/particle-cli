:: Builds the Particle CLI installer
::
:: Requirements:
:: - NuGet must be installed since it is used to install NSIS
:: - WINDOWS_CODE_SIGNING_CERT_ENCRYPTION_KEY environment variable must be set to decrypt the p12.enc code signing certificate
:: - WINDOWS_CODE_SIGNING_CERT_PASSWORD environment variable must be set to use the p12 code signing certificate to sign the final executable
::
:: Outputs:
:: - ParticleCLISetup.exe
pushd "%~dp0"

call decrypt_code_signing_cert.cmd || goto :error

nuget install NSIS-Tool -Version 3.0.8 || goto :error

"NSIS-Tool.3.0.8\tools\makensis.exe" ParticleCLISetup.nsi || goto :error
PowerShell "Get-FileHash ParticleCLISetup.exe -Algorithm MD5"

popd

goto :EOF

:error
exit /b %errorlevel%
