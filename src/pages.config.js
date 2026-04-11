import Orders from './pages/Orders';
import Dashboard from './pages/Dashboard';
import MenuManagement from './pages/MenuManagement';
import Statistics from './pages/Statistics';
import Loyverse from './pages/Loyverse';
import LoyverseOrders from './pages/LoyverseOrders';
import LVFinanzas from './pages/LVFinanzas';
import Clip from './pages/Clip';
import CustomerOrder from './pages/CustomerOrder';
import Customization from './pages/Customization';
import Integrations from './pages/Integrations';
import ShoppingList from './pages/ShoppingList';
import CompanyAccount from './pages/CompanyAccount';
import EmployeeCalendar from './pages/EmployeeCalendar';
import FinanceSummary from './pages/FinanceSummary';
import DailyCash from './pages/DailyCash';
import ManagementInsight from './pages/ManagementInsight';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Orders": Orders,
    "Dashboard": Dashboard,
    "MenuManagement": MenuManagement,
    "Statistics": Statistics,
    "Loyverse": Loyverse,
    "LoyverseOrders": LoyverseOrders,
    "LVFinanzas": LVFinanzas,
    "Clip": Clip,
    "CustomerOrder": CustomerOrder,
    "Customization": Customization,
    "Integrations": Integrations,
    "ShoppingList": ShoppingList,
    "Finance": FinanceSummary,
    "DailyCash": DailyCash,
    "ManagementInsight": ManagementInsight,
    "CompanyAccount": CompanyAccount,
    "EmployeeCalendar": EmployeeCalendar,
}

export const pagesConfig = {
    mainPage: "CustomerOrder",
    Pages: PAGES,
    Layout: __Layout,
};
