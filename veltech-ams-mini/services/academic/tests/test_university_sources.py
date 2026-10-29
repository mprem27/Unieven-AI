import unittest
import asyncio
from types import SimpleNamespace
from unittest.mock import patch
from app.services.university_sources import parse_news
class SourceNewsTests(unittest.TestCase):
 def test_only_official_news_links_are_published_and_duplicates_are_removed(self):
  html='<a href="/events/campus-2026/">University campus event for students</a><a href="/events/campus-2026/">University campus event for students</a><a href="https://attacker.example/events/x">External event pretending to be news</a><a href="javascript:alert(1)">Not an official university event</a>'
  items=parse_news(html);self.assertEqual(len(items),1);self.assertTrue(items[0]['url'].startswith('https://www.veltech.edu.in/'))
 def test_retired_parent_sources_are_not_requested_and_home_is_an_ams_client_reference(self):
  from app.services import university_sources as sources
  sources._cache.clear();requested=[]
  def response(url,**kwargs):
   requested.append(url)
   return SimpleNamespace(status_code=200,ok=True,text='<form><input name="captcha"><input type="hidden" name="loginNonce" value="test-nonce"></form>')
  with patch.object(sources.requests,'get',response):result=asyncio.run(sources.source_status())
  self.assertFalse(any('miniapps.veltech' in url or 'StuLogin/Parent' in url for url in requested))
  home=next(item for item in result['sources'] if item['id']=='home')
  self.assertIn('com.siva.homeofveltech',home['url']);self.assertEqual(home['providerType'],'reference');self.assertEqual(home['dataSource'],'ams')
