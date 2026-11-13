<?php
declare(strict_types=1);
final class BibiRelayError extends RuntimeException {
 public int $status;
 public function __construct(int $status) {parent::__construct('Analytics relay rejected request');$this->status=$status;}
}
function bibi_relay_b64(string $value): string {return rtrim(strtr(base64_encode($value),'+/','-_'),'=');}
function bibi_relay_public_ip(string $ip): ?string {
 if (preg_match('/[%\s,]/',$ip)) return null;
 if (str_starts_with(strtolower($ip),'::ffff:') && filter_var(substr($ip,7),FILTER_VALIDATE_IP,FILTER_FLAG_IPV4)) $ip=substr($ip,7);
 if (!filter_var($ip,FILTER_VALIDATE_IP,FILTER_FLAG_NO_PRIV_RANGE|FILTER_FLAG_NO_RES_RANGE)) return null;
 $packed=inet_pton($ip);if($packed===false)return null;
 // PHP's flags do not exclude every documentation/multicast/shared range. Explicitly reject those too.
 $ranges=['0.0.0.0/8','100.64.0.0/10','192.0.0.0/24','192.0.2.0/24','198.18.0.0/15','198.51.100.0/24','203.0.113.0/24','224.0.0.0/4','240.0.0.0/4','2001:db8::/32','ff00::/8','fc00::/7','fe80::/10','2001::/23','192.88.99.0/24','192.175.48.0/24','192.31.196.0/24','192.52.193.0/24','fec0::/10','100::/64','::ffff:0:0:0/96','64:ff9b::/96','64:ff9b:1::/48','2002::/16','2620:4f:8000::/48','5f00::/16','3fff::/20'];
 foreach($ranges as $cidr){[$network,$bits]=explode('/',$cidr);$prefix=inet_pton($network);if(strlen($prefix)!==strlen($packed))continue;$whole=intdiv((int)$bits,8);$rest=(int)$bits%8;if(substr($packed,0,$whole)===substr($prefix,0,$whole)&&($rest===0||((ord($packed[$whole])^ord($prefix[$whole]))>>(8-$rest))===0))return null;}
 return inet_ntop($packed)?:null;
}
function bibi_relay_reject_headers(array $headers): void {
 $denied=['x-forwarded-for','x-real-ip','forwarded','client-ip','cf-connecting-ip','true-client-ip','x-cluster-client-ip','!~passenger-client-address','x-bibi-relay-context','x-bibi-relay-signature'];
 foreach($headers as $name=>$value)if(in_array(strtolower(str_replace('_','-',(string)$name)),$denied,true))throw new BibiRelayError(403);
}
function bibi_relay_cookie(string $raw): string {
 $found=null;
 foreach(explode(';',$raw) as $part){$pair=explode('=',trim($part),2);if($pair[0]!=='bibi_visitor')continue;$value=$pair[1]??'';
  // Express cookie-parser decodes percent escaping once; forward that same canonical value.
  $value=rawurldecode($value);if(strlen($value)>512||preg_match('/[^A-Za-z0-9._~-]/',$value))throw new BibiRelayError(403);
  if($found!==null&&!hash_equals($found,$value))throw new BibiRelayError(403);$found=$value;
 }return $found??'';
}
function bibi_relay_envelope(array $f,string $secret): array {
 $key=base64_decode(strtr($secret,'-_','+/'),true);if(!preg_match('/^[A-Za-z0-9_-]{43}$/',$secret)||$key===false||strlen($key)!==32||bibi_relay_b64($key)!==$secret)throw new BibiRelayError(503);
 $raw=implode("\n",['bibi-analytics-v1',(string)$f['timestamp'],$f['requestId'],'POST','/api/analytics/collect',$f['bodySha256'],$f['ip'],bibi_relay_b64($f['origin']),$f['cookieSha256'],bibi_relay_b64($f['userAgent']),$f['dnt']?'1':'0',$f['gpc']?'1':'0','']);
 return ['context'=>bibi_relay_b64($raw),'signature'=>hash_hmac('sha256',$raw,$key)];
}

function bibi_relay_safe_set_cookie(string $line,bool $secure): bool {
 if(preg_match('/[\r\n]/',$line))return false;
 $parts=explode(';',$line);$pair=array_shift($parts);
 if(!preg_match('/^bibi_visitor=[A-Za-z0-9._~-]*$/',$pair))return false;
 $attrs=[];
 foreach($parts as $part){$entry=explode('=',trim($part),2);$name=strtolower($entry[0]);$value=$entry[1]??'';
  if(array_key_exists($name,$attrs)||!in_array($name,['path','httponly','secure','samesite','expires','max-age'],true))return false;
  if(($name==='httponly'||$name==='secure')&&$value!=='')return false;
  if($name==='max-age'&&!preg_match('/^[0-9]+$/',$value))return false;
  if($name==='expires'&&strtotime($value)===false)return false;
  $attrs[$name]=$value;
 }
 return ($attrs['path']??'')==='/api/analytics'&&array_key_exists('httponly',$attrs)&&strtolower($attrs['samesite']??'')==='lax'&&(!$secure||array_key_exists('secure',$attrs));
}
