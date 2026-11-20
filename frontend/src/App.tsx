import {Link,Route,Routes} from 'react-router-dom'
import {Layers3,SlidersHorizontal} from 'lucide-react'
import {Detail} from './pages/Detail'
import {useQuery} from '@tanstack/react-query'
import {api} from './lib/api'
import type {CatalogResult} from './lib/types'
import {ProductImage} from './components/Shared'
function Catalog(){const {data}=useQuery({queryKey:['catalog-demo'],queryFn:({signal})=>api<CatalogResult>('/catalog',signal)});return <><h1>کفش را بهتر بشناس.</h1><div className="product-grid">{data?.items.map(s=><Link className="shoe-card" key={s.shoe_id} to={`/shoe/${s.slug}`}><ProductImage src={s.image_url} name={s.name}/><h2 dir="ltr">{s.name}</h2></Link>)}</div></>}
export function App(){return <><header className="site-header"><div className="header-inner"><Link className="brand" to="/"><span className="brand-mark"><Layers3/></span><strong>راد<span>RAD</span></strong></Link><nav aria-label="ناوبری اصلی"><Link to="/">کشف کفش</Link><Link to="/finder">پیدا کردن کفش من</Link><Link to="/compare">مقایسه</Link></nav><span className="header-note"><SlidersHorizontal size={16}/> انتخاب، با شناخت بیشتر</span></div></header><main id="main" className="container"><Routes><Route path="/" element={<Catalog/>}/><Route path="/shoe/:slug" element={<Detail/>}/></Routes></main></>}
