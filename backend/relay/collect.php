<?php
declare(strict_types=1);
require_once __DIR__.'/context.php';
ini_set('display_errors','0');
header('Cache-Control: no-store');
function bibi_relay_fail(int $status): void {http_response_code($status);header('Content-Type: application/json');echo json_encode(['error'=>['code'=>'ANALYTICS_RELAY_REJECTED','message'=>'Không thể ghi nhận truy cập lúc này']]);}
try {
 $config=$bibiRelayConfig??json_decode(file_get_contents(getenv('BIBI_RELAY_CONFIG_FILE')?:'/nonexistent/bibi-relay-config'),true,16,JSON_THROW_ON_ERROR);
 if(!is_array($config))throw new BibiRelayError(503);
 $local=($config['environment']??'production')==='local';
 $target=parse_url($config['targetUrl']??'');
 if(!is_array($target)||($target['path']??'')!=='/api/analytics/collect'||isset($target['user'])||isset($target['pass'])||isset($target['query'])||isset($target['fragment'])||(!in_array($target['scheme']??'', ['https'],true)&&!($local&&($target['scheme']??'')==='http'&&in_array($target['host']??'',['127.0.0.1','localhost','host.docker.internal'],true))))throw new BibiRelayError(503);
 if(($_SERVER['REQUEST_METHOD']??'')!=='POST')throw new BibiRelayError(405);
 $headers=function_exists('getallheaders')?getallheaders():[];bibi_relay_reject_headers($headers);
 $origin=$_SERVER['HTTP_ORIGIN']??'';
 if(!is_string($origin)||!in_array($origin,$config['origins']??[],true))throw new BibiRelayError(403);
 $ua=$_SERVER['HTTP_USER_AGENT']??'';
 if(strlen($ua)>512||preg_match('/[\x00-\x1f\x7f]/',$ua))throw new BibiRelayError(403);
 if(!preg_match('/^application\/json(?:;\s*charset=utf-8)?$/i',$_SERVER['CONTENT_TYPE']??''))throw new BibiRelayError(415);
 if((int)($_SERVER['CONTENT_LENGTH']??0)>16384)throw new BibiRelayError(413);
 $body=file_get_contents('php://input',false,null,0,16385);if($body===false)throw new BibiRelayError(400);if(strlen($body)>16384)throw new BibiRelayError(413);
 try{json_decode($body,true,32,JSON_THROW_ON_ERROR);}catch(JsonException $e){throw new BibiRelayError(400);}
 $cookie=bibi_relay_cookie($_SERVER['HTTP_COOKIE']??'');$dnt=($_SERVER['HTTP_DNT']??'')==='1';$gpc=($_SERVER['HTTP_SEC_GPC']??'')==='1';
 $ip=bibi_relay_public_ip($_SERVER['REMOTE_ADDR']??'');
 $forward=['Content-Type: application/json','Origin: '.$origin,'User-Agent: '.$ua,'DNT: '.($dnt?'1':'0'),'Sec-GPC: '.($gpc?'1':'0')];
 if($cookie!=='')$forward[]='Cookie: bibi_visitor='.$cookie;
 // Local/private peers still collect anonymously, without inventing an IP context.
 if($ip!==null){$envelope=bibi_relay_envelope(['timestamp'=>time(),'requestId'=>bin2hex(random_bytes(16)),'bodySha256'=>hash('sha256',$body),'ip'=>$ip,'origin'=>$origin,'cookieSha256'=>hash('sha256',$cookie),'userAgent'=>$ua,'dnt'=>$dnt,'gpc'=>$gpc],$config['secret']??'');$forward[]='X-Bibi-Relay-Context: '.$envelope['context'];$forward[]='X-Bibi-Relay-Signature: '.$envelope['signature'];}
 $started=microtime(true);
 $context=stream_context_create(['http'=>['method'=>'POST','header'=>implode("\r\n",$forward),'content'=>$body,'timeout'=>5,'ignore_errors'=>true,'follow_location'=>0,'max_redirects'=>0,'protocol_version'=>1.1],'ssl'=>['verify_peer'=>true,'verify_peer_name'=>true]]);
 $stream=@fopen($config['targetUrl'],'rb',false,$context);if($stream===false)throw new BibiRelayError(502);
 try{
  $meta=stream_get_meta_data($stream);$responseHeaders=$meta['wrapper_data']??[];$status=0;$cookies=[];$json=false;
  foreach($responseHeaders as $line){if(preg_match('/^HTTP\/\S+\s+(\d{3})/',$line,$m))$status=(int)$m[1];elseif(stripos($line,'Set-Cookie:')===0)$cookies[]=trim(substr($line,11));elseif(preg_match('/^Content-Type:\s*application\/json\b/i',$line))$json=true;}
  if(!in_array($status,[202,204,400,403,409,413,415,429,500,502,503,504],true))throw new BibiRelayError(502);
  $response='';
  while(!feof($stream)){
   $left=5-(microtime(true)-$started);if($left<=0)throw new BibiRelayError(502);stream_set_timeout($stream,(int)$left,(int)(($left-(int)$left)*1000000));
   $part=fread($stream,min(8192,65537-strlen($response)));if($part===false)throw new BibiRelayError(502);$response.=$part;
   if(strlen($response)>65536||(stream_get_meta_data($stream)['timed_out']??false))throw new BibiRelayError(502);
  }
  if($response!==''&&!$json)throw new BibiRelayError(502);
  $allowedCookies=[];
  foreach($cookies as $line){if(!str_starts_with($line,'bibi_visitor='))continue;
   if(!bibi_relay_safe_set_cookie($line,!$local))throw new BibiRelayError(502);
   $allowedCookies[]=$line;
  }
  if(count($allowedCookies)>1)throw new BibiRelayError(502);
  http_response_code($status);if($response!=='')header('Content-Type: application/json');foreach($allowedCookies as $line)header('Set-Cookie: '.$line,false);if($status!==204)echo $response;
 }finally{fclose($stream);}
}catch(BibiRelayError $e){bibi_relay_fail($e->status);}catch(Throwable $e){bibi_relay_fail(503);}
