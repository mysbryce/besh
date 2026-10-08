import type { ClientCodeTarget } from './client-code-model'

const quoted = (value: string) =>
  JSON.stringify(value)
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029')
const javascript = (value: string) =>
  "'" +
  value.replace(/['\\\u0000-\u001f\u007f\u2028\u2029]/g, (character) => {
    if (character === "'") return "\\'"
    if (character === '\\') return '\\\\'
    return `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
  }) +
  "'"
const shell = (value: string) => `'${value.replaceAll("'", "'\\''")}'`
const php = (value: string) =>
  `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`
const rust = (value: string) =>
  '"' +
  Array.from(value, (character) => {
    const point = character.codePointAt(0)!
    return character === '"'
      ? '\\"'
      : character === '\\'
        ? '\\\\'
        : point < 32 || point > 126
          ? `\\u{${point.toString(16)}}`
          : character
  }).join('') +
  '"'
const cpp = (value: string) => {
  let index = 0
  while (value.includes(`)besh${index}"`)) index++
  const delimiter = `besh${index}`
  return `u8R"${delimiter}(${value})${delimiter}"`
}

export function renderClientCode(
  target: ClientCodeTarget,
  method: string,
  url: string,
  body?: string,
) {
  const jsonHeader =
    body === undefined ? '' : ", 'content-type': 'application/json'"
  if (target === 'javascript-fetch')
    return `if (!process.env.BESH_RUNTIME_API_KEY) throw new Error('Set BESH_RUNTIME_API_KEY')

const response = await fetch(${javascript(url)}, {
  method: ${javascript(method)},
  headers: { authorization: \`Bearer \${process.env.BESH_RUNTIME_API_KEY}\`${jsonHeader} },
  redirect: 'manual',
  signal: AbortSignal.timeout(10000),
${body === undefined ? '' : `  body: ${javascript(body)},\n`}})
console.log(response.status)
console.log(await response.text())
`
  if (target === 'javascript-axios')
    return `import axios from 'axios'

if (!process.env.BESH_RUNTIME_API_KEY) throw new Error('Set BESH_RUNTIME_API_KEY')

const response = await axios.request({
  url: ${javascript(url)},
  method: ${javascript(method)},
  headers: { authorization: \`Bearer \${process.env.BESH_RUNTIME_API_KEY}\`${jsonHeader} },
  maxRedirects: 0,
  timeout: 10000,
  validateStatus: () => true,
  responseType: 'text',
  transformResponse: [(data) => data],
${body === undefined ? '' : `  data: ${javascript(body)},\n  transformRequest: [(data) => data],\n`}})
console.log(response.status)
console.log(response.data)
`
  if (target === 'curl')
    return `#!/bin/sh
: "\${BESH_RUNTIME_API_KEY:?Set BESH_RUNTIME_API_KEY}"
${body === undefined ? '' : `printf '%s' ${shell(body)} | \\\n`}curl --max-time 10 --silent --show-error \\
  --request ${shell(method)}${method === 'HEAD' ? ' --head' : ''} \\
  --url ${shell(url)} \\
  --header "Authorization: Bearer \${BESH_RUNTIME_API_KEY}"${body === undefined ? '' : " \\\n  --header 'Content-Type: application/json' \\\n  --data-binary @-"}
`
  if (target === 'php-curl')
    return `<?php
$key = getenv('BESH_RUNTIME_API_KEY');
if ($key === false || $key === '') { throw new RuntimeException('Set BESH_RUNTIME_API_KEY'); }
$handle = curl_init(${php(url)});
curl_setopt_array($handle, [
    CURLOPT_CUSTOMREQUEST => '${method}',
    CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $key${body === undefined ? '' : ", 'Content-Type: application/json'"}],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_TIMEOUT => 10,
${method === 'HEAD' ? '    CURLOPT_NOBODY => true,\n' : ''}${body === undefined ? '' : `    CURLOPT_POSTFIELDS => ${php(body)},\n`}]);
$response = curl_exec($handle);
if ($response === false) { throw new RuntimeException(curl_error($handle)); }
echo curl_getinfo($handle, CURLINFO_HTTP_CODE) . "\\n";
echo $response . "\\n";
unset($handle);
`
  if (target === 'rust-reqwest')
    return `use std::time::Duration;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let key = std::env::var("BESH_RUNTIME_API_KEY")?;
    if key.is_empty() { return Err("Set BESH_RUNTIME_API_KEY".into()); }
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(10))
        .redirect(reqwest::redirect::Policy::none())
        .build()?;
    let response = client.request(reqwest::Method::from_bytes(b"${method}")?, ${rust(url)})
        .bearer_auth(key)
${body === undefined ? '' : `        .header("Content-Type", "application/json")\n        .body(${rust(body)})\n`}        .send()?;
    println!("{}", response.status().as_u16());
    println!("{}", response.text()?);
    Ok(())
}
`
  if (target === 'go-net-http')
    return `package main

import (
    "fmt"
    "io"
    "net/http"
    "os"
${body === undefined ? '' : '    "strings"\n'}    "time"
)

func main() {
    key := os.Getenv("BESH_RUNTIME_API_KEY")
    if key == "" { panic("Set BESH_RUNTIME_API_KEY") }
    client := &http.Client{Timeout: 10 * time.Second, CheckRedirect: func(req *http.Request, via []*http.Request) error { return http.ErrUseLastResponse }}
    req, err := http.NewRequest(${quoted(method)}, ${quoted(url)}, ${body === undefined ? 'nil' : `strings.NewReader(${quoted(body)})`})
    if err != nil { panic(err) }
    req.Header.Set("Authorization", "Bearer " + key)
${body === undefined ? '' : '    req.Header.Set("Content-Type", "application/json")\n'}    response, err := client.Do(req)
    if err != nil { panic(err) }
    defer response.Body.Close()
    data, err := io.ReadAll(response.Body)
    if err != nil { panic(err) }
    fmt.Println(response.StatusCode)
    fmt.Println(string(data))
}
`
  if (target === 'java-http-client')
    return `import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
public class Main {
    public static void main(String[] args) throws Exception {
        String key = System.getenv("BESH_RUNTIME_API_KEY");
        if (key == null || key.isEmpty()) { throw new IllegalStateException("Set BESH_RUNTIME_API_KEY"); }
        HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).followRedirects(HttpClient.Redirect.NEVER).build();
${body === undefined ? '' : `        String body = ${quoted(body)};\n`}        HttpRequest request = HttpRequest.newBuilder(URI.create(${quoted(url)}))
            .timeout(Duration.ofSeconds(10))
            .header("Authorization", "Bearer " + key)
${body === undefined ? '' : '            .header("Content-Type", "application/json")\n'}            .method("${method}", ${body === undefined ? 'HttpRequest.BodyPublishers.noBody()' : 'HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8)'})
            .build();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        System.out.println(response.statusCode());
        System.out.write(response.body().getBytes(StandardCharsets.UTF_8));
        System.out.write(10);
    }
}
`
  return `#include <curl/curl.h>
#include <cstdlib>
#include <iostream>
#include <string>

static size_t collect(char* data, size_t size, size_t count, void* output) {
    size_t length = size * count;
    static_cast<std::string*>(output)->append(data, length);
    return length;
}

int main() {
    const char* key = std::getenv("BESH_RUNTIME_API_KEY");
    if (!key || !*key) { std::cerr << "Set BESH_RUNTIME_API_KEY\\n"; return 1; }
    if (curl_global_init(CURL_GLOBAL_DEFAULT) != CURLE_OK) return 1;
    CURL* handle = curl_easy_init();
    if (!handle) { curl_global_cleanup(); return 1; }
    std::string authorization = std::string("Authorization: Bearer ") + key;
    curl_slist* headers = curl_slist_append(nullptr, authorization.c_str());
${body === undefined ? '' : '    headers = curl_slist_append(headers, "Content-Type: application/json");\n'}    std::string response;
    curl_easy_setopt(handle, CURLOPT_URL, ${cpp(url)});
    curl_easy_setopt(handle, CURLOPT_CUSTOMREQUEST, "${method}");
    curl_easy_setopt(handle, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(handle, CURLOPT_FOLLOWLOCATION, 0L);
    curl_easy_setopt(handle, CURLOPT_TIMEOUT, 10L);
    curl_easy_setopt(handle, CURLOPT_NOSIGNAL, 1L);
${method === 'HEAD' ? '    curl_easy_setopt(handle, CURLOPT_NOBODY, 1L);\n' : ''}${body === undefined ? '' : `    const std::string body = ${cpp(body)};\n    curl_easy_setopt(handle, CURLOPT_POSTFIELDS, body.data());\n    curl_easy_setopt(handle, CURLOPT_POSTFIELDSIZE, static_cast<long>(body.size()));\n`}    curl_easy_setopt(handle, CURLOPT_WRITEFUNCTION, collect);
    curl_easy_setopt(handle, CURLOPT_WRITEDATA, &response);
    CURLcode result = curl_easy_perform(handle);
    long status = 0;
    curl_easy_getinfo(handle, CURLINFO_RESPONSE_CODE, &status);
    if (result == CURLE_OK) std::cout << status << "\\n" << response << "\\n";
    else std::cerr << curl_easy_strerror(result) << "\\n";
    curl_slist_free_all(headers);
    curl_easy_cleanup(handle);
    curl_global_cleanup();
    return result == CURLE_OK ? 0 : 1;
}
`
}
