Param(
  [string]$KeystorePath = "keys\jinja-release.jks",
  [string]$Alias = "jinja_alias",
  [string]$StorePass = "changeit",
  [string]$KeyPass = $StorePass
)

if (-not (Test-Path (Split-Path $KeystorePath))) {
  New-Item -ItemType Directory -Path (Split-Path $KeystorePath) -Force | Out-Null
}

Write-Host "Generating keystore at: $KeystorePath"

$dname = 'CN=Jinja College, OU=IT, O=Jinja College, L=Jinja, ST=Jinja, C=UG'

$cmd = "keytool -genkeypair -v -keystore `"$KeystorePath`" -alias $Alias -storepass $StorePass -keypass $KeyPass -keyalg RSA -keysize 2048 -validity 10000 -dname `"$dname`""

Write-Host "Running: $cmd"
Invoke-Expression $cmd

Write-Host "Keystore created at $KeystorePath. DO NOT commit the keystore to source control. Move it to secure storage."
