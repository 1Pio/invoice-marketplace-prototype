import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import './App.css'  // oder './App.css', je nachdem


// We'll use some placeholders for shadcn/ui components:
// In a real project, you'd import from your configured shadcn/ui library, e.g.:
// import { Card, CardContent } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// For demonstration, let's just define some dummy components:

function Card({ children, className }) {
  return (
    <div
      className={`rounded-2xl shadow-md p-4 bg-white m-2 border border-gray-200 ${className}`}
    >
      {children}
    </div>
  );
}

function Button({ children, onClick, variant = "default", className = "" }) {
  let baseStyle =
    "rounded-2xl px-4 py-2 shadow-md transition-all duration-300 border-none";
  let variantStyle = "bg-blue-500 text-white hover:bg-blue-600";
  if (variant === "outline") {
    variantStyle = "bg-white text-blue-600 hover:bg-blue-100 border border-blue-600";
  } else if (variant === "danger") {
    variantStyle = "bg-red-500 text-white hover:bg-red-600";
  }
  return (
    <button onClick={onClick} className={`${baseStyle} ${variantStyle} ${className}`}>
      {children}
    </button>
  );
}

// ----- Data Models ----- //
// We'll define a user object to represent either a business or a customer,
// plus possibly a combined account that can switch modes.
// For this prototype, everything is in memory.

let nextInvoiceId = 1;

export default function InvoiceMarketplacePrototype() {
  // We'll have multiple "modes": business, customer, profile.
  const [mode, setMode] = useState("customer"); // "business" | "customer" | "profile"

  // We'll store a single user. In a real system, we'd have multiple users.
  const [currentUser, setCurrentUser] = useState({
    id: 1,
    name: "MegaCorp & Co.",
    businessRating: 4.5,
    reliabilityRating: 4.2,
    trustScore: 4.5, // Combine for demonstration.
    walletBalance: 2000,
    isVerifiedBusiness: true,
  });

  // We'll store all invoices in memory.
  const [invoices, setInvoices] = useState([]);

  // Periodically check if any invoice is past its end time.
  useEffect(() => {
    const timer = setInterval(() => {
      setInvoices((prev) => {
        const updated = prev.map((inv) => {
          if (!inv.finalized) {
            const now = Date.now();
            if (now >= inv.endTime.getTime()) {
              // Bidding ended
              if (inv.autoAcceptHighest) {
                // finalize automatically with highest bid if it meets min requirements
                if (inv.bids.length > 0) {
                  const highestBid = inv.bids.reduce((max, b) => {
                    if (b.amount > max.amount) return b;
                    return max;
                  }, inv.bids[0]);

                  if (highestBid.amount >= inv.minBid) {
                    // finalize with highestBid
                    return finalizeInvoice(inv, highestBid);
                  } else {
                    // no sale because highest bid didn't meet the minBid
                    toast.info(
                      `Invoice #${inv.id} ended. Highest bid didn't meet the minimum. No sale.`
                    );
                    return { ...inv, finalized: true };
                  }
                } else {
                  // no bids
                  return { ...inv, finalized: true };
                }
              } else {
                // Time is up but business chooses manually
                return { ...inv, biddingEnded: true };
              }
            }
          }
          return inv;
        });
        return updated;
      });
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  function finalizeInvoice(invoice, winningBid) {
    // Move funds from the bidder to the business.
    // (All in-memory. For real, we'd find that user from DB, do a transaction, etc.)
    toast.success(`Invoice #${invoice.id} is finalized with bid of €${winningBid.amount}`);
    return {
      ...invoice,
      finalized: true,
      winningBid,
    };
  }

  // Handling new invoice uploads.
  function handleUploadInvoice({ title, amount, autoAcceptHighest, endTime, minBid }) {
    if (!title || !amount || !endTime) {
      toast.error("Please fill out all invoice fields.");
      return;
    }

    const newInvoice = {
      id: nextInvoiceId++,
      businessId: currentUser.id,
      title,
      amount: parseFloat(amount),
      autoAcceptHighest,
      endTime: new Date(endTime),
      bids: [],
      finalized: false,
      biddingEnded: false,
      minBid: autoAcceptHighest ? parseFloat(minBid || 0) : 0,
    };

    setInvoices((prev) => [...prev, newInvoice]);
    toast.success("Invoice uploaded successfully.");
  }

  // Placing a bid.
  function placeBid(invoiceId, bidAmount) {
    setInvoices((prevInvoices) => {
      return prevInvoices.map((inv) => {
        if (inv.id === invoiceId) {
          if (inv.finalized) {
            toast.error("Bidding is closed. Invoice already finalized.");
            return inv;
          }
          if (Date.now() > inv.endTime.getTime()) {
            toast.error("Bidding time is over.");
            return inv;
          }
          // Check max allowed
          const maxAllowed = inv.amount - 20;
          if (bidAmount > maxAllowed) {
            toast.error(
              `Your bid is above the allowed maximum of €${maxAllowed}`
            );
            return inv;
          }
          // Check if below minBid
          if (bidAmount < inv.minBid) {
            toast.error(
              `Your bid is below the required minimum of €${inv.minBid}`
            );
            return inv;
          }
          // Check if user has enough wallet balance
          if (currentUser.walletBalance < bidAmount) {
            toast.error("Insufficient wallet balance.");
            return inv;
          }

          // Lock the funds by removing from user's wallet.
          setCurrentUser((prevUser) => ({
            ...prevUser,
            walletBalance: prevUser.walletBalance - bidAmount,
          }));

          const newBid = {
            userId: currentUser.id,
            amount: bidAmount,
            timePlaced: new Date(),
          };
          toast.success("Bid placed successfully!");

          return {
            ...inv,
            bids: [...inv.bids, newBid],
          };
        }
        return inv;
      });
    });
  }

  // Business manually selects a winning bid.
  function manuallySelectBid(invoiceId, selectedBid) {
    setInvoices((prev) => {
      return prev.map((inv) => {
        if (inv.id === invoiceId) {
          if (inv.finalized) {
            toast.error("Invoice already finalized.");
            return inv;
          }
          // The business can do it any time, ignoring if bidding ended or not.
          return finalizeInvoice(inv, selectedBid);
        }
        return inv;
      });
    });
  }

  // Deposit money.
  function handleDepositMoney(amount) {
    if (!amount || isNaN(amount)) {
      toast.error("Invalid deposit amount.");
      return;
    }
    setCurrentUser((prev) => ({
      ...prev,
      walletBalance: prev.walletBalance + parseFloat(amount),
    }));
    toast.success(`Deposited €${amount} to your wallet.`);
  }

  // Switch modes.
  function switchMode(newMode) {
    setMode(newMode);
  }

  // We'll show business rating if we have it, or trust.
  // For multi-user, we'd fetch from a user list. Here we only have one.

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <ToastContainer position="top-right" />
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="p-4 border-b border-gray-300 bg-white flex justify-between items-center"
      >
        <div className="text-xl font-bold">Invoice Trading Prototype</div>
        <div className="space-x-2">
          <Button
            variant={mode === "business" ? "outline" : "default"}
            onClick={() => switchMode("business")}
          >
            Business Mode
          </Button>
          <Button
            variant={mode === "customer" ? "outline" : "default"}
            onClick={() => switchMode("customer")}
          >
            Customer Mode
          </Button>
          <Button
            variant={mode === "profile" ? "outline" : "default"}
            onClick={() => switchMode("profile")}
          >
            Profile
          </Button>
        </div>
      </motion.div>

      {mode === "business" && (
        <BusinessView
          currentUser={currentUser}
          invoices={invoices.filter((inv) => inv.businessId === currentUser.id)}
          onUpload={handleUploadInvoice}
          onManualSelect={manuallySelectBid}
        />
      )}
      {mode === "customer" && (
        <CustomerView
          currentUser={currentUser}
          invoices={invoices.filter((inv) => !inv.finalized)}
          onDeposit={handleDepositMoney}
          onPlaceBid={placeBid}
        />
      )}
      {mode === "profile" && <ProfileView currentUser={currentUser} />}
    </div>
  );
}

function BusinessView({ invoices, onUpload, onManualSelect }) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [autoAcceptHighest, setAutoAcceptHighest] = useState(false);
  const [endTime, setEndTime] = useState("");
  const [minBid, setMinBid] = useState("");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4"
    >
      <div className="text-2xl font-semibold mb-4">Business Dashboard</div>
      <Card>
        <div className="font-bold text-lg mb-2">Upload Invoice</div>
        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <label className="block mb-1">Title</label>
            <input
              type="text"
              className="bg-white text-black border border-gray-300 rounded-md p-2 focus:border-blue-500 focus:ring focus:ring-blue-200 w-full"
              //oreginal: className="border w-full rounded-lg p-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="block mb-1">Amount (€)</label>
            <input
              type="number"
              className="bg-white text-black border border-gray-300 rounded-md p-2 focus:border-blue-500 focus:ring focus:ring-blue-200 w-full"
              //oreginal: className="border w-full rounded-lg p-2"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-2 mt-2 md:grid-cols-3">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="autoHighest"
              checked={autoAcceptHighest}
              onChange={(e) => {
                setAutoAcceptHighest(e.target.checked);
              }}
            />
            <label htmlFor="autoHighest">Auto Accept Highest Bid</label>
          </div>
          <div>
            <label className="block mb-1">Bidding End Time</label>
            <input
              type="datetime-local"
              className="bg-white text-black border border-gray-300 rounded-md p-2 focus:border-blue-500 focus:ring focus:ring-blue-200 w-full"
              //oreginal: className="border w-full rounded-lg p-2"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
          {autoAcceptHighest && (
            <div>
              <label className="block mb-1">Minimum Bid (€)</label>
              <input
                type="number"
                className="bg-white text-black border border-gray-300 rounded-md p-2 focus:border-blue-500 focus:ring focus:ring-blue-200 w-full"
                //oreginal: className="border w-full rounded-lg p-2"
                value={minBid}
                onChange={(e) => setMinBid(e.target.value)}
              />
            </div>
          )}
        </div>
        <div className="mt-4">
          <Button
            onClick={() => {
              onUpload({ title, amount, autoAcceptHighest, endTime, minBid });
              setTitle("");
              setAmount("");
              setAutoAcceptHighest(false);
              setEndTime("");
              setMinBid("");
            }}
          >
            Upload
          </Button>
        </div>
      </Card>

      <div className="mt-6 font-semibold text-lg">Your Invoices</div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {invoices.map((inv) => (
          <Card key={inv.id}>
            <div className="mb-2 text-md font-bold">
              #{inv.id} - {inv.title}
            </div>
            <div>Amount: €{inv.amount}</div>
            <div>End Time: {inv.endTime.toLocaleString()}</div>
            <div className="text-sm text-gray-600">
              {inv.autoAcceptHighest
                ? `Auto-Finalize (Min: €${inv.minBid || 0})`
                : "Manual-Finalize"}
            </div>
            <div className="text-sm">
              {inv.biddingEnded && !inv.finalized && (
                <div className="text-red-500 font-bold">
                  Bidding ended. Manual finalize pending!
                </div>
              )}
              {inv.finalized && inv.winningBid && (
                <div className="text-green-600 font-bold">
                  Finalized with bid: €{inv.winningBid.amount}
                </div>
              )}
              {inv.finalized && !inv.winningBid && (
                <div className="text-gray-600">No Bids or Not Sold.</div>
              )}
            </div>
            <div className="mt-2">
              <div className="text-sm font-semibold mb-1">Bids:</div>
              {inv.bids.map((b, index) => (
                <div key={index} className="text-sm flex justify-between">
                  <span>Bidder #{b.userId}</span>
                  <span>€{b.amount}</span>
                  <span>{b.timePlaced.toLocaleString()}</span>
                </div>
              ))}
              {!inv.finalized && inv.bids.length > 0 && (
                <div className="mt-2">
                  {inv.bids.map((b, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      className="m-1"
                      onClick={() => onManualSelect(inv.id, b)}
                    >
                      Finalize w/€{b.amount}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </motion.div>
  );
}

function CustomerView({ currentUser, invoices, onDeposit, onPlaceBid }) {
  const [depositValue, setDepositValue] = useState("");
  const [selectedBidValue, setSelectedBidValue] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4"
    >
      <div className="text-2xl font-semibold mb-4">Customer Dashboard</div>
      <Card>
        <div className="mb-2 font-bold">Wallet</div>
        <div className="mb-2">Balance: €{currentUser.walletBalance}</div>
        <div className="flex items-center space-x-2">
          <input
            type="number"
            className="bg-white text-black border border-gray-300 rounded-md p-2 focus:border-blue-500 focus:ring focus:ring-blue-200 w-full"
            //oreginal: className="border w-full rounded-lg p-2"
            placeholder="Enter amount to deposit"
            value={depositValue}
            onChange={(e) => setDepositValue(e.target.value)}
          />
          <Button
            onClick={() => {
              onDeposit(depositValue);
              setDepositValue("");
            }}
          >
            Deposit
          </Button>
        </div>
      </Card>

      <div className="mt-6 font-semibold text-lg">Available Invoices</div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {invoices.map((inv) => (
          <Card key={inv.id}>
            <div className="mb-2 text-md font-bold">
              #{inv.id} - {inv.title}
            </div>
            <div>Amount: €{inv.amount}</div>
            <div>End Time: {inv.endTime.toLocaleString()}</div>
            <div className="text-sm text-gray-600">
              {inv.autoAcceptHighest
                ? `Auto-Finalize (Min: €${inv.minBid || 0})`
                : "Manual-Finalize"}
            </div>
            {inv.finalized ? (
              <div className="text-sm text-green-600 font-bold">Finalized</div>
            ) : (
              <div>
                <Button
                  variant="outline"
                  className="mt-2"
                  onClick={() => setSelectedInvoice(inv)}
                >
                  Place Bid
                </Button>
              </div>
            )}
            <div className="mt-2 text-sm font-semibold">Bids:</div>
            {inv.bids.map((b, index) => (
              <div key={index} className="text-sm flex justify-between">
                <span>Bidder #{b.userId}</span>
                <span>€{b.amount}</span>
                <span>{b.timePlaced.toLocaleString()}</span>
              </div>
            ))}
          </Card>
        ))}
      </div>

      {/* Simple Modal for placing a bid */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
          <div className="bg-white p-6 rounded-xl w-96 relative">
            <div className="text-lg font-bold mb-4">
              Place a Bid on Invoice #{selectedInvoice.id}
            </div>
            <div className="mb-2">
              Max Allowed: €{selectedInvoice.amount - 20}, Min Required: €{selectedInvoice.minBid}
            </div>
            <input
              type="number"
              className="bg-white text-black border border-gray-300 rounded-md p-2 focus:border-blue-500 focus:ring focus:ring-blue-200 w-full"
              //oreginal: className="border w-full rounded-lg p-2"
              placeholder="Enter your bid"
              value={selectedBidValue}
              onChange={(e) => setSelectedBidValue(e.target.value)}
            />
            <div className="mt-4 flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedInvoice(null);
                  setSelectedBidValue("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  onPlaceBid(selectedInvoice.id, parseFloat(selectedBidValue));
                  setSelectedInvoice(null);
                  setSelectedBidValue("");
                }}
              >
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function ProfileView({ currentUser }) {
  // We'll just show user info, trust rating, wallet, etc.

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4"
    >
      <div className="text-2xl font-semibold mb-4">User Profile</div>
      <Card>
        <div className="text-lg font-bold mb-2">General Info</div>
        <div>Name: {currentUser.name}</div>
        <div>Verified Business: {currentUser.isVerifiedBusiness ? "Yes" : "No"}</div>
        <div>Trust Score: {currentUser.trustScore}</div>
        <div>Wallet Balance: €{currentUser.walletBalance}</div>
      </Card>
    </motion.div>
  );
}
