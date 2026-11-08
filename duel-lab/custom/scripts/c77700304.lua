--業火葬－点火する見習い
--Gokasou - Igniting Apprentice (original card)
local s,id=GetID()
local SET_GOKASOU=0x7c2
local CARD_PURGATORY=77700305
function s.initial_effect(c)
	--① discard this card: add "Gokasou Crematorium - Purgatory" from the Deck to the hand or Set it;
	--   if "Purgatory" is on the field, you can instead Special Summon 1 "Gokasou" monster from the hand/GY
	local e1=Effect.CreateEffect(c)
	e1:SetDescription(aux.Stringid(id,0))
	e1:SetCategory(CATEGORY_TOHAND+CATEGORY_SEARCH+CATEGORY_SPECIAL_SUMMON)
	e1:SetType(EFFECT_TYPE_IGNITION)
	e1:SetRange(LOCATION_HAND)
	e1:SetCost(s.thcost)
	e1:SetTarget(s.thtg)
	e1:SetOperation(s.thop)
	c:RegisterEffect(e1)
	--② in the GY, a card in the opponent's GY is banished: add this card to the hand
	local e2=Effect.CreateEffect(c)
	e2:SetDescription(aux.Stringid(id,1))
	e2:SetCategory(CATEGORY_TOHAND)
	e2:SetType(EFFECT_TYPE_FIELD+EFFECT_TYPE_TRIGGER_O)
	e2:SetProperty(EFFECT_FLAG_DELAY)
	e2:SetCode(EVENT_REMOVE)
	e2:SetRange(LOCATION_GRAVE)
	e2:SetCountLimit(1,{id,1})
	e2:SetCondition(s.rthcon)
	e2:SetTarget(s.rthtg)
	e2:SetOperation(s.rthop)
	c:RegisterEffect(e2)
end
s.listed_series={SET_GOKASOU}
s.listed_names={CARD_PURGATORY}
function s.thcost(e,tp,eg,ep,ev,re,r,rp,chk)
	local c=e:GetHandler()
	if chk==0 then return c:IsDiscardable() end
	Duel.SendtoGrave(c,REASON_COST+REASON_DISCARD)
end
function s.ffilter(c)
	return c:IsCode(CARD_PURGATORY) and (c:IsAbleToHand() or c:IsSSetable())
end
function s.fieldfilter(c)
	return c:IsFaceup() and c:IsCode(CARD_PURGATORY)
end
function s.spfilter(c,e,tp)
	return c:IsSetCard(SET_GOKASOU) and c:IsMonster() and c:IsCanBeSpecialSummoned(e,0,tp,false,false)
end
function s.canspsummon(e,tp)
	return Duel.IsExistingMatchingCard(s.fieldfilter,tp,LOCATION_FZONE,LOCATION_FZONE,1,nil)
		and Duel.GetLocationCount(tp,LOCATION_MZONE)>0
		and Duel.IsExistingMatchingCard(aux.NecroValleyFilter(s.spfilter),tp,LOCATION_HAND+LOCATION_GRAVE,0,1,nil,e,tp)
end
function s.thtg(e,tp,eg,ep,ev,re,r,rp,chk)
	if chk==0 then return Duel.IsExistingMatchingCard(s.ffilter,tp,LOCATION_DECK,0,1,nil) or s.canspsummon(e,tp) end
	Duel.SetOperationInfo(0,CATEGORY_TOHAND,nil,1,tp,LOCATION_DECK)
end
function s.thop(e,tp,eg,ep,ev,re,r,rp)
	local search=Duel.IsExistingMatchingCard(s.ffilter,tp,LOCATION_DECK,0,1,nil)
	if s.canspsummon(e,tp) and (not search or Duel.SelectYesNo(tp,aux.Stringid(id,2))) then
		Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_SPSUMMON)
		local g=Duel.SelectMatchingCard(tp,aux.NecroValleyFilter(s.spfilter),tp,LOCATION_HAND+LOCATION_GRAVE,0,1,1,nil,e,tp)
		if #g>0 then Duel.SpecialSummon(g,0,tp,tp,false,false,POS_FACEUP) end
		return
	end
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_ATOHAND)
	local tc=Duel.SelectMatchingCard(tp,s.ffilter,tp,LOCATION_DECK,0,1,1,nil):GetFirst()
	if not tc then return end
	if tc:IsAbleToHand() and (not tc:IsSSetable() or Duel.SelectOption(tp,1190,1153)==0) then
		Duel.SendtoHand(tc,nil,REASON_EFFECT)
		Duel.ConfirmCards(1-tp,tc)
	else
		Duel.SSet(tp,tc)
	end
end
function s.rmfilter(c,tp)
	return c:IsPreviousLocation(LOCATION_GRAVE) and c:IsPreviousControler(1-tp)
end
function s.rthcon(e,tp,eg,ep,ev,re,r,rp)
	return eg:IsExists(s.rmfilter,1,nil,tp)
end
function s.rthtg(e,tp,eg,ep,ev,re,r,rp,chk)
	local c=e:GetHandler()
	if chk==0 then return c:IsAbleToHand() end
	Duel.SetOperationInfo(0,CATEGORY_TOHAND,c,1,0,0)
end
function s.rthop(e,tp,eg,ep,ev,re,r,rp)
	local c=e:GetHandler()
	if c:IsRelateToEffect(e) then
		Duel.SendtoHand(c,nil,REASON_EFFECT)
		Duel.ConfirmCards(1-tp,c)
	end
end
