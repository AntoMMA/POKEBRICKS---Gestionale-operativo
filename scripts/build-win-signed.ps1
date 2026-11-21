$ErrorActionPreference = 'Stop'
$certPath = $env:POKEBRICKS_CERT_PATH
$localConfig = Join-Path $PSScriptRoot '..\.env.local'
if (-not $certPath -and (Test-Path -LiteralPath $localConfig)) {
  $setting = Get-Content -LiteralPath $localConfig | Where-Object { $_ -match '^POKEBRICKS_CERT_PATH=' } | Select-Object -First 1
  if ($setting) { $certPath = $setting.Substring('POKEBRICKS_CERT_PATH='.Length).Trim().Trim('"').Trim("'") }
}
if (-not $certPath) { $certPath = Read-Host 'Percorso del certificato PFX' }

if (-not (Test-Path -LiteralPath $certPath -PathType Leaf)) {
  throw "Certificato non trovato: $certPath"
}

$securePassword = Read-Host 'Password del certificato di firma' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
  # Validate that this PFX contains a private key authorized for Authenticode signing.
  $pfx = Get-PfxData -FilePath $certPath -Password $securePassword
  $cert = @($pfx.EndEntityCertificates)[0]
  if (-not $cert -or -not $cert.HasPrivateKey) {
    throw 'Il certificato non contiene una chiave privata utilizzabile.'
  }
  if ($cert.NotAfter -le (Get-Date)) { throw 'Il certificato è scaduto.' }
  $codeSigningOid = '1.3.6.1.5.5.7.3.3'
  if (-not ($cert.Extensions | Where-Object { $_.Oid.Value -eq '2.5.29.37' } | ForEach-Object { $_.EnhancedKeyUsages } | Where-Object { $_.Value -eq $codeSigningOid })) {
    throw 'Il certificato non dichiara l’uso Code Signing.'
  }

  $env:CSC_LINK = $certPath
  $env:CSC_KEY_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  npm run dist:win
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
finally {
  $env:CSC_LINK = $null
  $env:CSC_KEY_PASSWORD = $null
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  $securePassword.Dispose()
}
