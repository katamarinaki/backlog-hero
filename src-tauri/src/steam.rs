use crate::store::{valid_game, Result};
use reqwest::Client;
use serde_json::{json, Value};
use std::time::Duration;

pub struct Steam {
    pub client: Client,
}
impl Steam {
    pub fn new() -> Result<Self> {
        Ok(Self {
            client: Client::builder()
                .timeout(Duration::from_secs(15))
                .build()
                .map_err(|e| e.to_string())?,
        })
    }
    async fn get(&self, url: &str, params: &[(&str, String)]) -> Result<Value> {
        for attempt in 0..2 {
            let response = self
                .client
                .get(url)
                .query(params)
                .send()
                .await
                .map_err(|_| "Steam request failed or timed out".to_string())?;
            let code = response.status();
            if code.is_success() {
                return response
                    .json()
                    .await
                    .map_err(|_| "Invalid Steam response".into());
            }
            if attempt == 0 && (code.as_u16() == 429 || code.is_server_error()) {
                tokio::time::sleep(Duration::from_millis(if code.as_u16() == 429 {
                    1000
                } else {
                    200
                }))
                .await;
            } else {
                return Err(format!("Steam returned HTTP {code}"));
            }
        }
        unreachable!()
    }
    pub async fn games(&self, key: &str, id: &str) -> Result<Value> {
        let data = self
            .get(
                "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/",
                &[
                    ("key", key.into()),
                    ("steamid", id.into()),
                    ("include_appinfo", "true".into()),
                    ("include_played_free_games", "true".into()),
                    ("format", "json".into()),
                ],
            )
            .await?;
        if data["response"]["games"]
            .as_array()
            .is_some_and(|games| games.iter().all(valid_game))
        {
            Ok(data["response"]["games"].clone())
        } else {
            Err(
                "Steam did not return a library. Check your credentials and profile privacy."
                    .into(),
            )
        }
    }
    pub async fn rating(&self, id: u64) -> Option<Value> {
        let data = self
            .get(
                &format!("https://store.steampowered.com/appreviews/{id}"),
                &[
                    ("json", "1".into()),
                    ("language", "all".into()),
                    ("purchase_type", "all".into()),
                ],
            )
            .await
            .ok()?;
        if data["success"] != 1 || !data["query_summary"].is_object() {
            return None;
        }
        let p = data["query_summary"]["total_positive"]
            .as_u64()
            .unwrap_or(0);
        let n = data["query_summary"]["total_negative"]
            .as_u64()
            .unwrap_or(0);
        let total = p + n;
        let score = if total == 0 {
            0
        } else {
            (p as f64 * 100.0 / total as f64).round() as u64
        };
        Some(
            json!({"positive":p,"negative":n,"total":total,"score":score,"description":description(score)}),
        )
    }
    pub async fn achievements(&self, appid: u64, key: &str, id: &str) -> Option<Value> {
        let data = self
            .get(
                "https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/",
                &[
                    ("appid", appid.to_string()),
                    ("key", key.into()),
                    ("steamid", id.into()),
                ],
            )
            .await
            .ok()?;
        let entries = data["playerstats"]["achievements"].as_array()?;
        Some(
            json!({"total":entries.len(),"achieved":entries.iter().filter(|v| v["achieved"] == 1).count()}),
        )
    }
    pub async fn covers(&self, ids: &[u64]) -> Value {
        let mut covers = json!({});
        for chunk in ids.chunks(100) {
            let input = json!({"ids":chunk.iter().map(|id| json!({"appid":id})).collect::<Vec<_>>(),
                "context":{"language":"english","country_code":"US"},"data_request":{"include_assets":true}});
            if let Ok(data) = self
                .get(
                    "https://api.steampowered.com/IStoreBrowseService/GetItems/v1/",
                    &[("input_json", input.to_string())],
                )
                .await
            {
                if let Some(items) = data["response"]["store_items"].as_array() {
                    for item in items {
                        if let (Some(id), Some(format), Some(file)) = (
                            item["appid"].as_u64().or(item["id"].as_u64()),
                            item["assets"]["asset_url_format"].as_str(),
                            item["assets"]["library_capsule"].as_str(),
                        ) {
                            covers[id.to_string()] = json!(format!(
                                "https://shared.akamai.steamstatic.com/store_item_assets/{}",
                                format.replace("${FILENAME}", file)
                            ));
                        }
                    }
                }
            }
        }
        covers
    }
}
fn description(score: u64) -> &'static str {
    match score {
        95.. => "Overwhelmingly Positive",
        85.. => "Very Positive",
        80.. => "Positive",
        70.. => "Mostly Positive",
        40.. => "Mixed",
        20.. => "Mostly Negative",
        15.. => "Negative",
        5.. => "Very Negative",
        _ => "Overwhelmingly Negative",
    }
}
