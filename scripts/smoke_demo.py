from fastapi.testclient import TestClient
from app.main import app
with TestClient(app) as client:
    result = client.get('/api/catalog').json()
    assert result['total'] >= 4
    categories=set()
    for s in result['items']:
        response=client.get('/api/shoes/'+s['slug'])
        assert response.status_code==200,response.text
        d=response.json()
        assert d['metrics']['weight_g']['unit']=='g'
        assert 'insole_thickness_mm' in d['metrics']
        categories.update(s['categories'])
        print(s['name'],s['geometry_status'],len(d['variants']),'verified colorways')
    assert len(categories)>=3
print('Real PostgreSQL → API vertical slice verified.')
