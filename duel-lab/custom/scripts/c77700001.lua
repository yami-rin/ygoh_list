--連鎖律－イニシエータ
--Chain Code - Initiator (original card)
local s,id=GetID()
local SET_CHAIN_CODE=0x1f0
function s.initial_effect(c)
	--① search a "Chain Code" Spell/Trap when Normal or Special Summoned
	local e1=Effect.CreateEffect(c)
	e1:SetDescription(aux.Stringid(id,0))
	e1:SetCategory(CATEGORY_TOHAND+CATEGORY_SEARCH)
	e1:SetType(EFFECT_TYPE_SINGLE+EFFECT_TYPE_TRIGGER_O)
	e1:SetProperty(EFFECT_FLAG_DELAY)
	e1:SetCode(EVENT_SUMMON_SUCCESS)
	e1:SetCountLimit(1,{id,0})
	e1:SetCondition(s.samechain)
	e1:SetCost(s.markchain)
	e1:SetTarget(s.sttg)
	e1:SetOperation(s.stop)
	c:RegisterEffect(e1)
	local e1b=e1:Clone()
	e1b:SetCode(EVENT_SPSUMMON_SUCCESS)
	c:RegisterEffect(e1b)
	--② when you activate an effect: search a "Chain Code" monster except this name
	local e2=Effect.CreateEffect(c)
	e2:SetDescription(aux.Stringid(id,1))
	e2:SetCategory(CATEGORY_TOHAND+CATEGORY_SEARCH)
	e2:SetType(EFFECT_TYPE_QUICK_O)
	e2:SetCode(EVENT_CHAINING)
	e2:SetRange(LOCATION_MZONE)
	e2:SetCountLimit(1,{id,1})
	e2:SetCondition(s.owncon)
	e2:SetCost(s.markchain)
	e2:SetTarget(s.mtg)
	e2:SetOperation(s.mop)
	c:RegisterEffect(e2)
	--③ an effect activated as Chain Link 2 or higher: return this card from GY/banishment to hand
	local e3=Effect.CreateEffect(c)
	e3:SetDescription(aux.Stringid(id,2))
	e3:SetCategory(CATEGORY_TOHAND)
	e3:SetType(EFFECT_TYPE_QUICK_O)
	e3:SetCode(EVENT_CHAINING)
	e3:SetRange(LOCATION_GRAVE+LOCATION_REMOVED)
	e3:SetCountLimit(1,{id,2})
	e3:SetCondition(s.chain2con)
	e3:SetCost(s.markchain)
	e3:SetTarget(s.thtg)
	e3:SetOperation(s.thop)
	c:RegisterEffect(e3)
end
s.listed_series={SET_CHAIN_CODE}
--"cannot be activated in the same chain": one mark per chain shared by all three effects
function s.samechain(e,tp)
	return Duel.GetFlagEffect(tp,id)==0
end
function s.markchain(e,tp,eg,ep,ev,re,r,rp,chk)
	if chk==0 then return true end
	Duel.RegisterFlagEffect(tp,id,RESET_CHAIN,0,1)
end
function s.owncon(e,tp,eg,ep,ev,re,r,rp)
	return rp==tp and s.samechain(e,tp)
end
function s.chain2con(e,tp,eg,ep,ev,re,r,rp)
	return Duel.GetCurrentChain(true)>=2 and s.samechain(e,tp)
end
function s.stfilter(c)
	return c:IsSetCard(SET_CHAIN_CODE) and c:IsSpellTrap() and c:IsAbleToHand()
end
function s.sttg(e,tp,eg,ep,ev,re,r,rp,chk)
	if chk==0 then return Duel.IsExistingMatchingCard(s.stfilter,tp,LOCATION_DECK,0,1,nil) end
	Duel.SetOperationInfo(0,CATEGORY_TOHAND,nil,1,tp,LOCATION_DECK)
end
function s.stop(e,tp,eg,ep,ev,re,r,rp)
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_ATOHAND)
	local g=Duel.SelectMatchingCard(tp,s.stfilter,tp,LOCATION_DECK,0,1,1,nil)
	if #g>0 then Duel.SendtoHand(g,nil,REASON_EFFECT) Duel.ConfirmCards(1-tp,g) end
end
function s.mfilter(c)
	return c:IsSetCard(SET_CHAIN_CODE) and c:IsMonster() and not c:IsCode(id) and c:IsAbleToHand()
end
function s.mtg(e,tp,eg,ep,ev,re,r,rp,chk)
	if chk==0 then return Duel.IsExistingMatchingCard(s.mfilter,tp,LOCATION_DECK,0,1,nil) end
	Duel.SetOperationInfo(0,CATEGORY_TOHAND,nil,1,tp,LOCATION_DECK)
end
function s.mop(e,tp,eg,ep,ev,re,r,rp)
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_ATOHAND)
	local g=Duel.SelectMatchingCard(tp,s.mfilter,tp,LOCATION_DECK,0,1,1,nil)
	if #g>0 then Duel.SendtoHand(g,nil,REASON_EFFECT) Duel.ConfirmCards(1-tp,g) end
end
function s.thtg(e,tp,eg,ep,ev,re,r,rp,chk)
	local c=e:GetHandler()
	if chk==0 then return c:IsAbleToHand() end
	Duel.SetOperationInfo(0,CATEGORY_TOHAND,c,1,tp,0)
end
function s.thop(e,tp,eg,ep,ev,re,r,rp)
	local c=e:GetHandler()
	if c:IsRelateToEffect(e) then Duel.SendtoHand(c,nil,REASON_EFFECT) Duel.ConfirmCards(1-tp,c) end
end
