
import ReactDOM from "react-dom";
import {ShopifyApp} from "@shopify/app"


const pages = import.meta.globEager('./pages/**/!(*.test.[jt]sx)*.([jt]sx)')
ReactDOM.render(<ShopifyApp pages={pages} links/>, document.getElementById("app"));
