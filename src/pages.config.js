import Orders from './pages/Orders';
import Dashboard from './pages/Dashboard';
import MenuManagement from './pages/MenuManagement';
import Statistics from './pages/Statistics';
import CustomerOrder from './pages/CustomerOrder';
import Customization from './pages/Customization';
import ShoppingList from './pages/ShoppingList';
import CompanyAccount from './pages/CompanyAccount';
import EmployeeCalendar from './pages/EmployeeCalendar';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Orders": Orders,
    "Dashboard": Dashboard,
    "MenuManagement": MenuManagement,
    "Statistics": Statistics,
    "CustomerOrder": CustomerOrder,
    "Customization": Customization,
    "ShoppingList": ShoppingList,
    "CompanyAccount": CompanyAccount,
    "EmployeeCalendar": EmployeeCalendar,
}

export const pagesConfig = {
    mainPage: "CustomerOrder",
    Pages: PAGES,
    Layout: __Layout,
};