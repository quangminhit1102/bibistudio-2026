/** Throwaway routing/IP probe. No production relay is installed by this driver. */
import { randomBytes, createHmac, createHash } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
const workspace = resolve(".superpowers/sdd/2026-11-13-visitor-ip-relay/routing-spike");
const php = String.raw`<?php
ini_set('display_errors', '0');
$c = json_decode(file_get_contents('__CONFIG__'), true, 16, JSON_THROW_ON_ERROR);
if (time() > $c['expires']) { http_response_code(404); exit; }
$scope = str_starts_with($_SERVER['REQUEST_URI'], '/node-test/') ? 'test' : 'candidate';
$cookie = 'bibi_relay_probe_' . $c['id'];
$path = $scope === 'test' ? '/node-test/analytics' : '/api/analytics';
header('Cache-Control: no-store'); header('X-Robots-Tag: noindex, nofollow');
function answer($code, $data) {
 global $c, $scope;
 http_response_code($code); header('Content-Type: application/json');
 $data = array_merge(['id'=>$c['id'], 'scope'=>$scope], $data);
 $raw = json_encode($data, JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
 echo json_encode(['payload'=>rtrim(strtr(base64_encode($raw),'+/','-_'),'='), 'signature'=>hash_hmac('sha256',$raw,$c['hmac'])]); exit;
}
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
 setcookie($cookie, 'synthetic', ['expires'=>time()+1200,'path'=>$path,'secure'=>true,'httponly'=>true,'samesite'=>'Lax']);
 header('Content-Type: text/html; charset=utf-8');
?><!doctype html><meta name="robots" content="noindex"><title>Temporary relay routing check</title>
<h1>Temporary relay routing check</h1><p>Only synthetic cookie and signed diagnostic tags. No raw client IP is displayed.</p>
<label>Probe token <input id="token" type="password" autocomplete="off"></label><button id="run">Run checks</button><pre id="result"></pre>
<script>
document.querySelector('#run').onclick=async()=>{
 const checks=[];const cases=[['normal',{}],['repeat',{}],['xff',{'X-Forwarded-For':'198.51.100.77'}],['xreal',{'X-Real-IP':'198.51.100.77'}],['forwarded',{'Forwarded':'for=198.51.100.77'}],['underscore',{'X_Forwarded_For':'198.51.100.77'}],['secure',{'!~Passenger-Client-Address':'198.51.100.77'}],['multi',{'X-Forwarded-For':'198.51.100.77, 203.0.113.99'}],['oversize',{}]];
 for(const [name,headers] of cases){try{const r=await fetch(location.pathname,{method:'POST',credentials:'include',headers:{'Authorization':'Bearer '+document.querySelector('#token').value,'Content-Type':'application/json',...headers},body:name==='oversize'?'x'.repeat(16385):JSON.stringify({kind:'normal'})});checks.push({case:name,status:r.status,envelope:await r.json()});}catch{checks.push({case:name,error:'request failed before valid probe response'});}}
 document.querySelector('#result').textContent=JSON.stringify({source:'browser',checks},null,2);
};</script><?php exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); exit; }
$auth = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
if (!hash_equals('Bearer '.$c['bearer'], $auth)) { http_response_code(404); exit; }
$headers = function_exists('getallheaders') ? getallheaders() : [];
foreach ($headers as $name=>$value) {
 $name = strtolower(str_replace('_','-', $name));
 if (in_array($name,['x-forwarded-for','x-real-ip','forwarded','client-ip','cf-connecting-ip','true-client-ip','x-cluster-client-ip','!~passenger-client-address'],true)) answer(403,['kind'=>'forwarded_rejected']);
}
$body=file_get_contents('php://input',false,null,0,16385);
if (strlen($body)>16384) answer(413,['kind'=>'body_limit']);
$ip=$_SERVER['REMOTE_ADDR'] ?? '';
if (str_starts_with(strtolower($ip),'::ffff:') && filter_var(substr($ip,7),FILTER_VALIDATE_IP,FILTER_FLAG_IPV4)) $ip=substr($ip,7);
$public=filter_var($ip,FILTER_VALIDATE_IP,FILTER_FLAG_NO_PRIV_RANGE|FILTER_FLAG_NO_RES_RANGE)!==false;
answer(200,['kind'=>'normal','public'=>$public,'peerTag'=>hash_hmac('sha256',$ip,$c['hmac']),'cookieSeen'=>($_COOKIE[$cookie]??'')==='synthetic','php'=>PHP_VERSION,'bodyBytes'=>strlen($body)]);
`;
export function verifyChecks(receipt, secret, id, scope) {
  if (!Array.isArray(receipt.checks) || receipt.checks.length !== 9)
    throw new Error("Incomplete request matrix");
  const seen = new Set();
  const peers = [];
  for (const row of receipt.checks) {
    if (seen.has(row.case) || row.error || !row.envelope)
      throw new Error("Invalid/missing probe response");
    seen.add(row.case);
    const raw = Buffer.from(row.envelope.payload, "base64url");
    if (createHmac("sha256", secret).update(raw).digest("hex") !== row.envelope.signature)
      throw new Error("Probe signature mismatch");
    const value = JSON.parse(raw);
    if (value.id !== id || value.scope !== scope) throw new Error("Probe identity mismatch");
    const expected = ["normal", "repeat"].includes(row.case)
      ? 200
      : row.case === "oversize"
        ? 413
        : 403;
    if (row.status !== expected) throw new Error("Unexpected probe HTTP status");
    if (expected === 200) {
      if (!value.public || !value.cookieSeen || !/^\d+\.\d+\./.test(value.php))
        throw new Error("IP/cookie/PHP gate failed");
      peers.push(value.peerTag);
    } else if (value.kind !== (expected === 413 ? "body_limit" : "forwarded_rejected"))
      throw new Error("Not a probe rejection");
  }
  if (peers[0] !== peers[1]) throw new Error("Normal source unstable");
  return { source: receipt.source, scope, checks: 9, peerTag: peers[0] };
}
export async function prepare() {
  await mkdir(workspace, { recursive: true });
  const c = {
    id: randomBytes(6).toString("hex"),
    bearer: randomBytes(24).toString("hex"),
    hmac: randomBytes(32).toString("hex"),
    expires: Math.floor(Date.now() / 1000) + 1800,
  };
  await writeFile(join(workspace, "credentials.local.json"), JSON.stringify(c), {
    flag: "wx",
    mode: 0o600,
  });
  const privateDir = `/home/vhplasti/bibi-deploy/production/private/relay-routing-${c.id}`;
  const configPath = privateDir + "/config.json";
  const source = php.replace("__CONFIG__", configPath);
  for (const [scope, prefix] of [
    ["test", "node-test"],
    ["candidate", "api"],
  ]) {
    const target = `/home/vhplasti/bibistudio.vn/${prefix}/analytics/relay-${c.id}`;
    const code = `import pathlib,json,base64,hashlib,urllib.request\n`;
    const script =
      code +
      String.raw`c=json.loads(base64.b64decode('CFG'))
private=pathlib.Path('PRIVATE'); private.mkdir(mode=0o700,exist_ok=True)
config=private/'config.json'
if config.exists(): assert json.loads(config.read_text())==c
else:
 config.write_text(json.dumps(c));config.chmod(0o600)
target=pathlib.Path('TARGET'); assert not target.exists(), 'probe path exists'
parent=target.parent
if parent.exists(): assert parent.is_dir() and not parent.is_symlink()
else: parent.mkdir(mode=0o755);(private/'created-parent-SCOPE').write_text(str(parent))
target.mkdir(mode=0o755)
for name,data in {'.htaccess':b'PassengerEnabled off\n','collect.php':base64.b64decode('PHP')}.items():
 f=target/name;f.write_bytes(data);f.chmod(0o644)
print('PROBE_INSTALLED SCOPE '+c['id'])
`
        .replace("CFG", Buffer.from(JSON.stringify(c)).toString("base64"))
        .replaceAll("PRIVATE", privateDir)
        .replaceAll("TARGET", target)
        .replaceAll("SCOPE", scope)
        .replace("PHP", Buffer.from(source).toString("base64"));
    await writeFile(join(workspace, `install-${scope}.local.py`), script, { mode: 0o600 });
  }
  const clean = String.raw`import pathlib,json,hashlib,subprocess
private=pathlib.Path('PRIVATE'); c=json.loads((private/'config.json').read_text())
baseline=json.loads((private/'baseline.json').read_text())
def live(path):
 return json.loads(subprocess.check_output(['curl','-fsS','--max-time','15','https://bibistudio.vn'+path]))
rules={name:hashlib.sha256(pathlib.Path('/home/vhplasti/bibistudio.vn',part).read_bytes()).hexdigest() for name,part in [('root','.htaccess'),('api','api/.htaccess'),('test','node-test/.htaccess')]}
version=live('/api/version');ready=live('/api/ready')
assert rules==baseline['rules'], 'original routing changed; do not overwrite'
assert all(version.get(k)==v for k,v in baseline['version'].items()) and all(ready.get(k)==v for k,v in baseline['ready'].items()), 'release/readiness changed'
for prefix,scope in [('node-test','test'),('api','candidate')]:
 target=pathlib.Path('/home/vhplasti/bibistudio.vn')/prefix/'analytics'/('relay-'+c['id'])
 if target.exists():
  assert target.is_dir() and not target.is_symlink()
  for name in ['collect.php','.htaccess']:
   file=target/name
   if file.exists():
    assert file.is_file() and not file.is_symlink()
    if name=='.htaccess':assert file.read_bytes()==b'PassengerEnabled off\n'
    else:assert hashlib.sha256(file.read_bytes()).hexdigest()=='PHP_HASH'
    file.unlink()
  target.rmdir()
 parentMarker=private/('created-parent-'+scope)
 if parentMarker.exists():
  parent=pathlib.Path(parentMarker.read_text());assert parent==target.parent and not parent.is_symlink();parent.rmdir();parentMarker.unlink()
for name in ['config.json','baseline.json','host-test.json','host-candidate.json','curl-test.cookies','curl-candidate.cookies','curl.body']:
 file=private/name
 if file.exists():assert file.is_file() and not file.is_symlink();file.unlink()
private.rmdir()
print(json.dumps({'probeRemoved':True,'keyRemoved':True,'rulesUnchanged':True,'versionUnchanged':True,'ready':True,'releaseId':version.get('releaseId')}))
`
    .replaceAll("PRIVATE", privateDir)
    .replace("PHP_HASH", createHash("sha256").update(source).digest("hex"));
  await writeFile(join(workspace, "cleanup.local.py"), clean, { mode: 0o600 });
  await writeFile(join(workspace, "probe.php"), source);
  console.log(
    JSON.stringify({
      id: c.id,
      workspace,
      paths: [
        `https://bibistudio.vn/node-test/analytics/relay-${c.id}/collect.php`,
        `https://bibistudio.vn/api/analytics/relay-${c.id}/collect.php`,
      ],
      note: "Private scripts prepared only; nothing installed. Never print credential contents.",
    }),
  );
}
async function main() {
  if (process.argv[2] === "--prepare") await prepare();
  else if (process.argv[2] === "--verify") {
    const c = JSON.parse(await readFile(join(workspace, "credentials.local.json"), "utf8"));
    const receipt = JSON.parse(await readFile(process.argv[3], "utf8"));
    console.log(JSON.stringify(verifyChecks(receipt, c.hmac, c.id, process.argv[4])));
  } else throw new Error("Use --prepare or --verify FILE test|candidate");
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
