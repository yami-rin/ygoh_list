# Friend-side bridge for online duels: MDPro3 connects to 127.0.0.1:7911 in plain TCP and this script carries
# the connection over TLS to the host's Tailscale Funnel (TLS-terminated TCP), which hands it to the host's
# MDPro3 room on port 7911. No installation needed: it only uses .NET classes built into Windows.
param(
  [string]$RemoteHost = 'desktop-euas96s.tail26dd2a.ts.net',
  [int]$RemotePort = 10000,
  [int]$LocalPort = 7911
)
$ErrorActionPreference = 'Stop'
$listener = New-Object System.Net.Sockets.TcpListener ([System.Net.IPAddress]::Loopback), $LocalPort
$listener.Start()
Write-Host "Duel bridge: 127.0.0.1:$LocalPort -> ${RemoteHost}:$RemotePort (TLS)"

# Copies one direction until either side closes; runs on its own runspace so both directions flow at once.
$pump = {
  param($from, $to)
  $buf = New-Object byte[] 65536
  try {
    while (($n = $from.Read($buf, 0, $buf.Length)) -gt 0) { $to.Write($buf, 0, $n); $to.Flush() }
  } catch {} finally { try { $to.Dispose() } catch {}; try { $from.Dispose() } catch {} }
}

while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $client.NoDelay = $true
    $remote = New-Object System.Net.Sockets.TcpClient
    $remote.NoDelay = $true
    $remote.Connect($RemoteHost, $RemotePort)
    $tls = New-Object System.Net.Security.SslStream ($remote.GetStream(), $false)
    $tls.AuthenticateAsClient($RemoteHost)
    $local = $client.GetStream()
    foreach ($pair in @(@($local, $tls), @($tls, $local))) {
      $ps = [PowerShell]::Create().AddScript($pump).AddArgument($pair[0]).AddArgument($pair[1])
      [void]$ps.BeginInvoke()
    }
    Write-Host "connected $(Get-Date -Format HH:mm:ss)"
  } catch {
    Write-Host "connection failed: $($_.Exception.Message)"
    $client.Close()
  }
}
